'use client'

import { useConnection, useConnect, useConnectors, useDisconnect, useSwitchChain } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'

export function useWalletConnection() {
  const connection = useConnection()
  const { connect } = useConnect()
  const connectors = useConnectors()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()

  // Derive connection state
  const isConnected = connection.status === 'connected'
  const address = connection.addresses?.[0]
  const chainId = connection.chainId
  const chainName = connection.chain?.name
  const isWrongChain = isConnected && chainId !== baseSepolia.id

  const handleConnect = () => {
    const injected = connectors.find(c => c.id === 'injected') || connectors[0]
    if (injected) {
      connect({ connector: injected })
    }
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
    handleConnect,
    handleDisconnect,
    handleSwitchNetwork,
  }
}

