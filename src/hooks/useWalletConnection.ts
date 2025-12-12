'use client'

import { useEffect } from 'react'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useAccount, useDisconnect, useSwitchChain } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { useSmartWallet } from './useSmartWallet'

export function useWalletConnection() {
  const { address, isConnected, chain } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain()
  const { openConnectModal } = useConnectModal()
  const { isSmartWallet, isBaseAccount, isLoading } = useSmartWallet()

  const chainId = chain?.id
  const chainName = chain?.name

  // For smart wallets, we handle chain switching automatically.
  // Only show "wrong chain" UI for EOA wallets that need manual switching.
  // While loading capabilities, don't show the button (might be a smart wallet).
  const isWrongChain = isConnected && 
    chainId !== baseSepolia.id && 
    !isSmartWallet && 
    !isBaseAccount && 
    !isLoading

  // Auto-switch to Base Sepolia for smart wallets
  useEffect(() => {
    if ((isSmartWallet || isBaseAccount) && chainId !== baseSepolia.id) {
      switchChain({ chainId: baseSepolia.id })
    }
  }, [isSmartWallet, isBaseAccount, chainId, switchChain])

  return {
    isConnected,
    address,
    chainId,
    chainName,
    isWrongChain,
    isSmartWallet,
    isBaseAccount,
    isSwitchingChain,
    handleConnect: () => openConnectModal?.(),
    handleDisconnect: () => disconnect(),
    handleSwitchNetwork: () => switchChain({ chainId: baseSepolia.id }),
  }
}
