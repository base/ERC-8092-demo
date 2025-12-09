'use client'

import { useMemo, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useCapabilities } from 'wagmi/experimental'
import { baseSepolia } from 'wagmi/chains'

// Known smart wallet connector IDs - ONLY specific smart wallet connectors
// DO NOT include regular Coinbase Wallet here (it supports both EOA and smart wallet modes)
const SMART_WALLET_CONNECTOR_IDS = [
  'safe',
  'argent',
  'sequence',
]

/**
 * Check if connector name explicitly indicates a smart wallet.
 * This is a fallback check - we prefer capabilities detection.
 * Be conservative here to avoid false positives.
 */
function isExplicitSmartWalletConnector(connectorId?: string, connectorName?: string): boolean {
  if (!connectorId && !connectorName) return false
  
  const idLower = connectorId?.toLowerCase() ?? ''
  const nameLower = connectorName?.toLowerCase() ?? ''
  
  // Only match explicit smart wallet connectors
  // DO NOT match generic "coinbase" or "base" - these could be EOA mode
  const idMatches = SMART_WALLET_CONNECTOR_IDS.some(id => idLower === id.toLowerCase())
  
  // Name must explicitly say "smart wallet" or "smart account"
  const nameMatches = (
    nameLower.includes('smart wallet') ||
    nameLower.includes('smart account')
  )
  
  return idMatches || nameMatches
}

/**
 * Hook to detect smart wallet capabilities using EIP-5792 wallet_getCapabilities.
 */
export function useSmartWallet() {
  const { connector, isConnected, chainId: currentChainId } = useAccount()

  // Skip capabilities query for wallets that don't support it
  const isUnsupportedWallet = connector?.id === 'io.metamask' || connector?.id === 'metaMask'
  const enabled = isConnected && !isUnsupportedWallet

  const { data: rawCapabilities, isLoading, isError } = useCapabilities({ 
    query: { 
      enabled,
      // Prevent retries on error - wallet simply doesn't support it
      retry: false,
    } 
  })

  // Use Base Sepolia as the target chain for capability checks
  const targetChainId = currentChainId ?? baseSepolia.id

  /**
   * Check if a specific capability is supported on the target chain.
   */
  const isCapabilitySupported = useMemo(() => {
    return (capability: string): boolean => {
      if (!rawCapabilities || !targetChainId) return false
      const chainCapabilities = rawCapabilities[targetChainId]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (chainCapabilities as any)?.[capability]?.supported === true
    }
  }, [rawCapabilities, targetChainId])

  /**
   * Whether the connected wallet is a smart contract wallet.
   * Smart wallets typically support atomicBatch (batched transactions).
   * 
   * Detection priority:
   * 1. Capabilities (most reliable) - check for atomicBatch, paymasterService, etc.
   * 2. Explicit connector name - only if it explicitly says "smart wallet"
   * 
   * We do NOT detect based on generic "coinbase" or "base" in the name,
   * as those wallets can operate in both EOA and smart wallet modes.
   */
  const isSmartWallet = useMemo(() => {
    // Primary check: capabilities (most reliable indicator)
    if (rawCapabilities && targetChainId) {
      const chainCapabilities = rawCapabilities[targetChainId]
      if (chainCapabilities) {
        // Smart wallets typically support atomicBatch or have other AA capabilities
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const caps = chainCapabilities as any
        const hasSmartWalletCapabilities = (
          caps?.atomicBatch?.supported === true ||
          caps?.paymasterService?.supported === true ||
          caps?.auxiliaryFunds?.supported === true
        )
        if (hasSmartWalletCapabilities) {
          return true
        }
      }
    }
    
    // Fallback: check if connector explicitly indicates smart wallet
    // This is conservative - only matches known smart wallet connectors
    const connectorIndicatesSmartWallet = isExplicitSmartWalletConnector(connector?.id, connector?.name)
    if (connectorIndicatesSmartWallet) {
      return true
    }
    
    return false
  }, [rawCapabilities, targetChainId, connector?.id, connector?.name])

  // Debug: expose connector info to window for troubleshooting
  useEffect(() => {
    if (typeof window !== 'undefined' && connector) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any
      const connectorIndicatesSmartWallet = isExplicitSmartWalletConnector(connector?.id, connector?.name)
      
      // Check if capabilities indicate smart wallet
      let capabilitiesIndicateSmartWallet = false
      if (rawCapabilities && targetChainId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const caps = (rawCapabilities as any)[targetChainId]
        capabilitiesIndicateSmartWallet = !!(
          caps?.atomicBatch?.supported ||
          caps?.paymasterService?.supported ||
          caps?.auxiliaryFunds?.supported
        )
      }
      
      win.DEBUG = {
        ...win.DEBUG,
        connector: {
          id: connector.id,
          name: connector.name,
          type: connector.type,
        },
        isSmartWallet,
        connectorIndicatesSmartWallet,
        capabilitiesIndicateSmartWallet,
        rawCapabilities,
        targetChainId,
        currentChainId,
      }
      // Also log to console for easier debugging
      console.log('[useSmartWallet] Debug:', {
        connectorId: connector.id,
        connectorName: connector.name,
        isSmartWallet,
        connectorIndicatesSmartWallet,
        capabilitiesIndicateSmartWallet,
        hasCapabilities: !!rawCapabilities,
      })
    }
  }, [connector, isSmartWallet, rawCapabilities, targetChainId, currentChainId])

  return {
    isSmartWallet,
    isLoading,
    rawCapabilities,
    isCapabilitySupported,
    targetChainId,
  }
}
