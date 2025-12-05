'use client'

import { useMemo, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useCapabilities } from 'wagmi/experimental'
import { baseSepolia } from 'wagmi/chains'

// Known smart wallet connector IDs - includes various naming conventions
const SMART_WALLET_CONNECTOR_IDS = [
  'coinbaseWalletSDK',
  'coinbaseWallet', 
  'com.coinbase.wallet',
  'baseAccount',
  'safe',
  'argent',
  'sequence',
]

/**
 * Check if connector ID or name indicates a Coinbase Smart Wallet
 */
function isCoinbaseSmartWalletConnector(connectorId?: string, connectorName?: string): boolean {
  if (!connectorId && !connectorName) return false
  
  const idLower = connectorId?.toLowerCase() ?? ''
  const nameLower = connectorName?.toLowerCase() ?? ''
  
  return (
    idLower.includes('coinbase') ||
    nameLower.includes('coinbase') ||
    idLower.includes('base') ||
    SMART_WALLET_CONNECTOR_IDS.includes(connectorId ?? '')
  )
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
   */
  const isSmartWallet = useMemo(() => {
    // First check: connector ID/name for known smart wallets (fast, synchronous)
    const connectorIndicatesSmartWallet = isCoinbaseSmartWalletConnector(connector?.id, connector?.name)
    
    // If connector indicates smart wallet, return true immediately
    // This avoids waiting for capabilities which may be slow or fail
    if (connectorIndicatesSmartWallet) {
      return true
    }
    
    // If capabilities query errored or is disabled, fall back to connector check
    if (isError || !enabled) {
      return false
    }
    
    // If we have capabilities data, check for smart wallet indicators
    if (rawCapabilities && targetChainId) {
      const chainCapabilities = rawCapabilities[targetChainId]
      if (chainCapabilities) {
        // Smart wallets typically support atomicBatch or have other AA capabilities
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const caps = chainCapabilities as any
        return (
          caps?.atomicBatch?.supported === true ||
          caps?.paymasterService?.supported === true ||
          caps?.auxiliaryFunds?.supported === true
        )
      }
    }
    
    return false
  }, [enabled, isError, rawCapabilities, targetChainId, connector?.id, connector?.name])

  // Debug: expose connector info to window for troubleshooting
  useEffect(() => {
    if (typeof window !== 'undefined' && connector) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any
      win.DEBUG = {
        ...win.DEBUG,
        connector: {
          id: connector.id,
          name: connector.name,
          type: connector.type,
        },
        isSmartWallet,
        rawCapabilities,
      }
    }
  }, [connector, isSmartWallet, rawCapabilities])

  return {
    isSmartWallet,
    isLoading,
    rawCapabilities,
    isCapabilitySupported,
    targetChainId,
  }
}
