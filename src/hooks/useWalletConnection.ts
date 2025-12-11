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
  const { isSmartWallet } = useSmartWallet()

  // Derive connection state
  const chainId = chain?.id
  const chainName = chain?.name
  
  // For smart wallets, don't show wrong chain warning/button since
  // we auto-switch for them. Only show for EOA wallets.
  const isWrongChain = isConnected && chainId !== baseSepolia.id && !isSmartWallet

  // Auto-switch network for smart wallets when they connect
  useEffect(() => {
    if (isSmartWallet) {
      switchChain({ chainId: baseSepolia.id })
    }
  }, [address, isSmartWallet, switchChain])

  const handleConnect = () => {
    openConnectModal?.()
  }

  const handleDisconnect = () => {
    disconnect()
  }

  const handleSwitchNetwork = () => {
    switchChain({ chainId: baseSepolia.id })
  }

  return {
    isConnected,
    address,
    chainId,
    chainName,
    isWrongChain,
    isSmartWallet,
    isSwitchingChain,
    handleConnect,
    handleDisconnect,
    handleSwitchNetwork,
  }
}
