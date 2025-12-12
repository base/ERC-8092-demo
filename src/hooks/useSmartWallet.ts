'use client'

import { useMemo } from 'react'
import { useAccount } from 'wagmi'
import { useCapabilities } from 'wagmi/experimental'
import { baseSepolia } from 'wagmi/chains'

/**
 * Simple hook to detect smart wallet capabilities.
 * 
 * Detection is straightforward:
 * 1. If connector is 'baseAccount' → it's a smart wallet
 * 2. If capabilities show atomicBatch/paymasterService support → it's a smart wallet
 */
export function useSmartWallet() {
  const { connector, isConnected } = useAccount()

  // Base Account is always a smart wallet - check connector ID directly
  const isBaseAccount = connector?.id === 'baseAccount'

  const { data: capabilities, isLoading } = useCapabilities({
    query: {
      enabled: isConnected && !isBaseAccount,
      retry: false,
    },
  })

  // Check if capabilities indicate smart wallet (for non-Base Account wallets)
  const hasSmartWalletCapabilities = useMemo(() => {
    if (!capabilities) return false
    
    // Check Base Sepolia capabilities (our target chain)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const caps = (capabilities as any)[baseSepolia.id]
    return !!(
      caps?.atomicBatch?.supported ||
      caps?.paymasterService?.supported
    )
  }, [capabilities])

  // Smart wallet if: Base Account OR has smart wallet capabilities
  const isSmartWallet = isBaseAccount || hasSmartWalletCapabilities

  return {
    isSmartWallet,
    isBaseAccount,
    isLoading: isBaseAccount ? false : isLoading,
    capabilities,
  }
}
