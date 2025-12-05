'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { type Hex, type Address, isAddress } from 'viem'
import { usePublicClient } from 'wagmi'
import { baseSepolia, mainnet } from 'wagmi/chains'
import cytoscape from 'cytoscape'
import { useWalletConnection } from '@/hooks'
import { ASSOCIATIONS_STORE_ADDRESS, associationsStoreAbi } from '@/lib/contracts'
import { extractAddress } from '@/lib/erc7930'
import { addressToErc7930, type AssociatedAccountRecord, type SignedAssociationRecord } from '@/lib/types'
import { validateAssociation } from '@/lib/validation'
import type { DbAssociation } from '@/lib/db'

interface FullAssociation {
  id: string
  initiator: string
  approver: string
  validAt: bigint
  validUntil: bigint
  revokedAt: bigint
  source: 'onchain' | 'offchain'
  isValid: boolean
  invalidReason?: string
  // Full record data for populating the visualization
  aar: AssociatedAccountRecord
  sar: SignedAssociationRecord
}

interface AssociationsGraphProps {
  onAssociationSelect?: (aar: AssociatedAccountRecord, sar: SignedAssociationRecord) => void
  /** Increment to trigger a data refresh */
  refreshTrigger?: number
}

export function AssociationsGraph({ onAssociationSelect, refreshTrigger = 0 }: AssociationsGraphProps) {
  const { isConnected, address: connectedAddress } = useWalletConnection()
  const publicClient = usePublicClient({ chainId: baseSepolia.id })
  const mainnetClient = usePublicClient({ chainId: mainnet.id })
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  
  // Search mode state
  const [searchMode, setSearchMode] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [searchAddress, setSearchAddress] = useState<string | null>(null)
  const [isResolvingEns, setIsResolvingEns] = useState(false)
  
  // The address to query associations for
  const targetAddress = searchMode && searchAddress ? searchAddress : connectedAddress
  
  const [onchainAssociations, setOnchainAssociations] = useState<FullAssociation[]>([])
  const [offchainAssociations, setOffchainAssociations] = useState<FullAssociation[]>([])
  const [ensNames, setEnsNames] = useState<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)

  // Handle search input - resolve ENS or validate address
  const handleSearch = useCallback(async () => {
    if (!searchInput.trim()) {
      setSearchAddress(null)
      return
    }

    const input = searchInput.trim()

    // Check if it's already a valid address
    if (isAddress(input)) {
      setSearchAddress(input.toLowerCase())
      return
    }

    // Try to resolve as ENS name
    if (input.includes('.') && mainnetClient) {
      setIsResolvingEns(true)
      try {
        const resolved = await mainnetClient.getEnsAddress({ name: input })
        if (resolved) {
          setSearchAddress(resolved.toLowerCase())
        } else {
          setSearchAddress(null)
        }
      } catch {
        setSearchAddress(null)
      }
      setIsResolvingEns(false)
    }
  }, [searchInput, mainnetClient])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(handleSearch, 500)
    return () => clearTimeout(timer)
  }, [handleSearch])

  // Reset search when toggling mode
  useEffect(() => {
    if (!searchMode) {
      setSearchInput('')
      setSearchAddress(null)
    }
  }, [searchMode])

  // Fetch onchain associations using getAssociationsForAccount
  useEffect(() => {
    if (!targetAddress || !publicClient) {
      setOnchainAssociations([])
      return
    }

    async function fetchOnchainAssociations() {
      if (!publicClient || !targetAddress) return
      setIsLoading(true)

      try {
        const accountBytes = addressToErc7930(targetAddress as Address, baseSepolia.id)

        const sars = await publicClient.readContract({
          address: ASSOCIATIONS_STORE_ADDRESS,
          abi: associationsStoreAbi,
          functionName: 'getAssociationsForAccount',
          args: [accountBytes],
        })

        const associations: FullAssociation[] = await Promise.all(
          sars.map(async (sar, index) => {
            const initiatorAddr = extractAddress(sar.record.initiator as Hex)
            const approverAddr = extractAddress(sar.record.approver as Hex)

            const aarData: AssociatedAccountRecord = {
              initiator: sar.record.initiator as Hex,
              approver: sar.record.approver as Hex,
              validAt: BigInt(sar.record.validAt),
              validUntil: BigInt(sar.record.validUntil),
              interfaceId: sar.record.interfaceId as Hex,
              data: sar.record.data as Hex,
            }

            const sarData: SignedAssociationRecord = {
              revokedAt: BigInt(sar.revokedAt),
              initiatorKeyType: parseInt(sar.initiatorKeyType, 16),
              approverKeyType: parseInt(sar.approverKeyType, 16),
              initiatorSignature: sar.initiatorSignature as Hex,
              approverSignature: sar.approverSignature as Hex,
              record: aarData,
            }

            const validation = await validateAssociation({
              aar: aarData,
              sar: sarData,
              initiatorAddress: initiatorAddr as Hex,
              approverAddress: approverAddr as Hex,
              publicClient,
            })

            return {
              id: `onchain-${index}`,
              initiator: initiatorAddr,
              approver: approverAddr,
              validAt: aarData.validAt,
              validUntil: aarData.validUntil,
              revokedAt: sarData.revokedAt,
              source: 'onchain' as const,
              isValid: validation.valid,
              invalidReason: validation.error,
              aar: aarData,
              sar: sarData,
            }
          })
        )

        setOnchainAssociations(associations)
      } catch (err) {
        console.error('Failed to fetch onchain associations:', err)
      }
      setIsLoading(false)
    }

    fetchOnchainAssociations()
  }, [targetAddress, publicClient, refreshTrigger])

  // Fetch offchain associations from database
  useEffect(() => {
    if (!targetAddress) {
      setOffchainAssociations([])
      return
    }

    async function fetchOffchainAssociations() {
      try {
        const response = await fetch(`/api/associations?address=${targetAddress}`)
        const data = await response.json()

        if (!data.success || !data.associations) {
          return
        }

        const associations: FullAssociation[] = await Promise.all(
          data.associations.map(async (dbAssoc: DbAssociation) => {
            const validAt = BigInt(dbAssoc.valid_at)
            const validUntil = dbAssoc.valid_until ? BigInt(dbAssoc.valid_until) : 0n
            const revokedAt = dbAssoc.revoked_at ? BigInt(dbAssoc.revoked_at) : 0n
            const interfaceId = (dbAssoc.interface_id || '0x00000000') as Hex
            const dataField = (dbAssoc.data || '0x') as Hex

            const aarData: AssociatedAccountRecord = {
              initiator: dbAssoc.initiator_bytes as Hex,
              approver: dbAssoc.approver_bytes as Hex,
              validAt,
              validUntil,
              interfaceId,
              data: dataField,
            }

            const sarData: SignedAssociationRecord = {
              revokedAt,
              initiatorKeyType: parseInt(dbAssoc.initiator_key_type, 16),
              approverKeyType: parseInt(dbAssoc.approver_key_type, 16),
              initiatorSignature: dbAssoc.initiator_signature as Hex,
              approverSignature: dbAssoc.approver_signature as Hex,
              record: aarData,
            }

            const validation = await validateAssociation({
              aar: aarData,
              sar: sarData,
              initiatorAddress: dbAssoc.initiator_address as Hex,
              approverAddress: dbAssoc.approver_address as Hex,
              publicClient,
            })

            return {
              id: `db-${dbAssoc.id}`,
              initiator: dbAssoc.initiator_address,
              approver: dbAssoc.approver_address,
              validAt,
              validUntil,
              revokedAt,
              source: 'offchain' as const,
              isValid: validation.valid,
              invalidReason: validation.error,
              aar: aarData,
              sar: sarData,
            }
          })
        )

        setOffchainAssociations(associations)
      } catch (err) {
        console.error('Failed to fetch offchain associations:', err)
      }
    }

    fetchOffchainAssociations()
  }, [targetAddress, refreshTrigger])

  // Combine and deduplicate associations (onchain takes precedence)
  const mergedAssociations = useMemo(() => {
    const pairMap = new Map<string, FullAssociation>()

    for (const assoc of onchainAssociations) {
      const key = [assoc.initiator.toLowerCase(), assoc.approver.toLowerCase()].sort().join('-')
      pairMap.set(key, assoc)
    }

    for (const assoc of offchainAssociations) {
      const key = [assoc.initiator.toLowerCase(), assoc.approver.toLowerCase()].sort().join('-')
      if (!pairMap.has(key)) {
        pairMap.set(key, assoc)
      }
    }

    return Array.from(pairMap.values())
  }, [onchainAssociations, offchainAssociations])

  // Create a map from association ID to full association for click handling
  const associationMap = useMemo(() => {
    const map = new Map<string, FullAssociation>()
    for (const assoc of mergedAssociations) {
      map.set(assoc.id, assoc)
    }
    return map
  }, [mergedAssociations])

  // Collect all unique addresses for ENS resolution
  const allAddresses = useMemo(() => {
    const addresses = new Set<string>()
    if (targetAddress) {
      addresses.add(targetAddress.toLowerCase())
    }
    for (const assoc of mergedAssociations) {
      addresses.add(assoc.initiator.toLowerCase())
      addresses.add(assoc.approver.toLowerCase())
    }
    return Array.from(addresses)
  }, [targetAddress, mergedAssociations])

  // Fetch ENS names for all addresses
  useEffect(() => {
    if (!mainnetClient || allAddresses.length === 0) {
      return
    }

    async function fetchEnsNames() {
      if (!mainnetClient) return

      const nameMap = new Map<string, string>()

      await Promise.all(
        allAddresses.map(async (addr) => {
          try {
            const name = await mainnetClient.getEnsName({
              address: addr as Address,
            })
            if (name) {
              nameMap.set(addr.toLowerCase(), name)
            }
          } catch {
            // ENS resolution failed
          }
        })
      )

      setEnsNames(nameMap)
    }

    fetchEnsNames()
  }, [mainnetClient, allAddresses])

  // Helper to get display name (ENS or truncated address)
  const getDisplayName = useCallback((addr: string): string => {
    const ensName = ensNames.get(addr.toLowerCase())
    if (ensName) {
      return ensName.length > 16 ? `${ensName.slice(0, 14)}...` : ensName
    }
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }, [ensNames])

  // Handle node click - copy address
  const handleNodeClick = useCallback(async (nodeId: string) => {
    try {
      await navigator.clipboard.writeText(nodeId)
      setCopiedAddress(nodeId)
      setTimeout(() => setCopiedAddress(null), 2000)
    } catch (err) {
      console.error('Failed to copy address:', err)
    }
  }, [])

  // Handle edge click - select association
  const handleEdgeClick = useCallback((edgeId: string) => {
    const assoc = associationMap.get(edgeId)
    if (assoc && onAssociationSelect) {
      onAssociationSelect(assoc.aar, assoc.sar)
    }
  }, [associationMap, onAssociationSelect])

  // Build Cytoscape elements with positions
  const elements = useMemo(() => {
    if (!targetAddress || mergedAssociations.length === 0) {
      return []
    }

    const targetLower = targetAddress.toLowerCase()
    const nodeSet = new Set<string>()
    const nodes: cytoscape.ElementDefinition[] = []
    const edges: cytoscape.ElementDefinition[] = []
    const otherAddresses: string[] = []

    // Collect other addresses first
    for (const assoc of mergedAssociations) {
      const otherAddr = assoc.initiator.toLowerCase() === targetLower
        ? assoc.approver.toLowerCase()
        : assoc.initiator.toLowerCase()
      if (!nodeSet.has(otherAddr)) {
        nodeSet.add(otherAddr)
        otherAddresses.push(otherAddr)
      }
    }

    // Calculate positions
    const containerHeight = 280
    const leftX = 120
    const rightX = 450
    const centerY = containerHeight / 2

    // Add target wallet node on the left
    nodes.push({
      data: {
        id: targetLower,
        label: getDisplayName(targetAddress),
        isConnected: true,
        fullAddress: targetAddress,
      },
      position: { x: leftX, y: centerY },
    })

    // Add other nodes on the right
    const nodeCount = otherAddresses.length
    const verticalSpacing = Math.min(80, (containerHeight - 60) / Math.max(nodeCount, 1))
    const startY = centerY - ((nodeCount - 1) * verticalSpacing) / 2

    otherAddresses.forEach((addr, index) => {
      nodes.push({
        data: {
          id: addr,
          label: getDisplayName(addr),
          isConnected: false,
          fullAddress: addr,
        },
        position: { x: rightX, y: startY + index * verticalSpacing },
      })
    })

    // Add edges
    for (const assoc of mergedAssociations) {
      const otherAddr = assoc.initiator.toLowerCase() === targetLower
        ? assoc.approver.toLowerCase()
        : assoc.initiator.toLowerCase()

      let edgeType: 'onchain' | 'offchain' | 'invalid' | 'revoked' = assoc.source
      if (assoc.revokedAt > 0n) {
        edgeType = 'revoked'
      } else if (!assoc.isValid) {
        edgeType = 'invalid'
      }

      edges.push({
        data: {
          id: assoc.id,
          source: targetLower,
          target: otherAddr,
          edgeType,
          isValid: assoc.isValid,
          invalidReason: assoc.invalidReason,
        },
      })
    }

    return [...nodes, ...edges]
  }, [targetAddress, mergedAssociations, getDisplayName])

  // Initialize and update Cytoscape
  useEffect(() => {
    if (!containerRef.current || elements.length === 0) {
      if (cyRef.current) {
        cyRef.current.destroy()
        cyRef.current = null
      }
      return
    }

    if (cyRef.current) {
      cyRef.current.destroy()
      cyRef.current = null
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'text-valign': 'center',
            'text-halign': 'right',
            'text-margin-x': 12,
            'font-size': '12px',
            'font-family': '"SF Mono", "Fira Code", monospace',
            'color': '#a0a0b0',
            'background-color': '#1a1a24',
            'border-width': 2,
            'border-color': '#2a2a3a',
            'width': 40,
            'height': 40,
          },
        },
        {
          selector: 'node[?isConnected]',
          style: {
            'background-color': '#6366f1',
            'border-color': '#818cf8',
            'border-width': 3,
            'width': 52,
            'height': 52,
            'color': '#818cf8',
            'font-weight': 600,
            'text-halign': 'left',
            'text-margin-x': -12,
          },
        },
        {
          selector: 'node:active',
          style: {
            'overlay-opacity': 0.2,
            'overlay-color': '#818cf8',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': '#22c55e',
            'line-color': '#22c55e',
            'arrow-scale': 1.2,
          },
        },
        {
          selector: 'edge[edgeType="onchain"]',
          style: {
            'line-color': '#22c55e',
            'target-arrow-color': '#22c55e',
          },
        },
        {
          selector: 'edge[edgeType="offchain"]',
          style: {
            'line-color': '#6366f1',
            'target-arrow-color': '#6366f1',
          },
        },
        {
          selector: 'edge[edgeType="invalid"]',
          style: {
            'line-color': '#ef4444',
            'target-arrow-color': '#ef4444',
            'line-style': 'dashed',
            'line-dash-pattern': [6, 4],
          },
        },
        {
          selector: 'edge[edgeType="revoked"]',
          style: {
            'line-color': '#ef4444',
            'target-arrow-color': '#ef4444',
            'label': '✕',
            'text-background-color': '#0f0f15',
            'text-background-opacity': 1,
            'text-background-padding': '4px',
            'font-size': '14px',
            'font-weight': 'bold',
            'color': '#ef4444',
            'text-valign': 'center',
            'text-halign': 'center',
          },
        },
        {
          selector: 'edge:active',
          style: {
            'overlay-opacity': 0.2,
            'overlay-color': '#f59e0b',
          },
        },
      ],
      layout: { name: 'preset' },
      userZoomingEnabled: false,
      userPanningEnabled: false,
      boxSelectionEnabled: false,
      autoungrabify: true,
    })

    // Add click handlers
    cy.on('tap', 'node', (evt) => {
      const nodeId = evt.target.id()
      handleNodeClick(nodeId)
    })

    cy.on('tap', 'edge', (evt) => {
      const edgeId = evt.target.id()
      handleEdgeClick(edgeId)
    })

    cyRef.current = cy

    return () => {
      cy.destroy()
      cyRef.current = null
    }
  }, [elements, handleNodeClick, handleEdgeClick])

  // Render empty state when not connected and not in search mode
  if (!isConnected && !searchMode) {
    return (
      <div className="graph-container">
        <div className="graph-header">
          <div className="graph-mode-toggle">
            <button
              className={`mode-btn ${!searchMode ? 'active' : ''}`}
              onClick={() => setSearchMode(false)}
            >
              Connected Wallet
            </button>
            <button
              className={`mode-btn ${searchMode ? 'active' : ''}`}
              onClick={() => setSearchMode(true)}
            >
              Search
            </button>
          </div>
          <div className="graph-legend">
            <div className="legend-item">
              <span className="legend-line onchain"></span>
              <span>Onchain</span>
            </div>
            <div className="legend-item">
              <span className="legend-line offchain"></span>
              <span>Offchain</span>
            </div>
            <div className="legend-item">
              <span className="legend-line revoked"></span>
              <span>Revoked</span>
            </div>
            <div className="legend-item">
              <span className="legend-line invalid"></span>
              <span>Invalid</span>
            </div>
          </div>
        </div>
        <div className="graph-empty">
          <p>Connect your wallet to view your associations</p>
        </div>
      </div>
    )
  }

  const showEmptyState = !targetAddress || mergedAssociations.length === 0

  return (
    <div className="graph-container">
      <div className="graph-header">
        <div className="graph-mode-toggle">
          <button
            className={`mode-btn ${!searchMode ? 'active' : ''}`}
            onClick={() => setSearchMode(false)}
            disabled={!isConnected}
            title={!isConnected ? 'Connect wallet first' : ''}
          >
            Connected Wallet
          </button>
          <button
            className={`mode-btn ${searchMode ? 'active' : ''}`}
            onClick={() => setSearchMode(true)}
          >
            Search
          </button>
        </div>
        {searchMode && (
          <div className="graph-search">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Address or ENS name..."
              className="search-input"
            />
            {isResolvingEns && <span className="search-status">Resolving...</span>}
          </div>
        )}
        <div className="graph-legend">
          <div className="legend-item">
            <span className="legend-line onchain"></span>
            <span>Onchain</span>
          </div>
          <div className="legend-item">
            <span className="legend-line offchain"></span>
            <span>Offchain</span>
          </div>
          <div className="legend-item">
            <span className="legend-line revoked"></span>
            <span>Revoked</span>
          </div>
          <div className="legend-item">
            <span className="legend-line invalid"></span>
            <span>Invalid</span>
          </div>
        </div>
      </div>

      {/* Copy notification */}
      {copiedAddress && (
        <div className="copy-notification">
          Copied {getDisplayName(copiedAddress)}!
        </div>
      )}
      
      {isLoading ? (
        <div className="graph-loading">
          <div className="spinner"></div>
          <p>Loading associations...</p>
        </div>
      ) : showEmptyState ? (
        <div className="graph-empty">
          <div className="empty-icon">🔗</div>
          <p>
            {searchMode && !searchAddress 
              ? 'Enter an address or ENS name to search'
              : 'No associations found for this wallet'
            }
          </p>
          {!searchMode && (
            <span className="empty-hint">Create an association above to get started</span>
          )}
        </div>
      ) : (
        <>
          <div className="graph-visualization" ref={containerRef} />
          <div className="graph-instructions">
            <span>Click node to copy address • Click edge to view details</span>
          </div>
        </>
      )}
    </div>
  )
}
