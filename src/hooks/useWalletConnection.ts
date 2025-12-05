'use client'

import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useAccount, useDisconnect, useSwitchChain } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { useSmartWallet } from './useSmartWallet'

export function useWalletConnection() {
  const { address, isConnected, chain } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { openConnectModal } = useConnectModal()
  const { isSmartWallet } = useSmartWallet()

  // Derive connection state
  const chainId = chain?.id
  const chainName = chain?.name
  
  // For smart wallets, don't show wrong chain warning since
  // our EIP-712 domain doesn't include chainId (signatures are chain-agnostic)
  const isWrongChain = isConnected && chainId !== baseSepolia.id && !isSmartWallet

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
    handleConnect,
    handleDisconnect,
    handleSwitchNetwork,
  }
}
