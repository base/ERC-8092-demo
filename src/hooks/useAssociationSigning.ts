'use client'

import { useState } from 'react'
import { useSignTypedData, useDisconnect, useAccount, usePublicClient, useSwitchChain } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import type { Hex } from 'viem'
import type { AssociatedAccountRecord, SignedAssociationRecord, FlowStep } from '@/lib/types'
import { KEY_TYPES } from '@/lib/types'
import { EIP712_DOMAIN, ASSOCIATED_ACCOUNT_RECORD_TYPES } from '@/lib/eip712'
import { isSmartContract } from '@/lib/erc1271'
import { isErc6492Signature } from '@/lib/erc6492'
import { useSmartWallet } from './useSmartWallet'

interface UseAssociationSigningProps {
  aar: AssociatedAccountRecord
  sar: SignedAssociationRecord
  setSar: (sar: SignedAssociationRecord) => void
  setFlowStep: (step: FlowStep) => void
  setError: (error: string | null) => void
}

export function useAssociationSigning({
  aar,
  sar,
  setSar,
  setFlowStep,
  setError,
}: UseAssociationSigningProps) {
  const { signTypedDataAsync } = useSignTypedData()
  const { disconnect } = useDisconnect()
  const { address, chain, connector } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { isSmartWallet } = useSmartWallet()
  // Always use Base Sepolia for contract detection regardless of wallet's current chain
  const publicClient = usePublicClient({ chainId: baseSepolia.id })
  const [isProcessing, setIsProcessing] = useState(false)

  /**
   * Get the chain ID to use for signing.
   * For smart wallets, returns the connector's actual chain ID.
   * For EOA wallets, ensures we're on Base Sepolia first.
   * Returns null if we can't proceed.
   */
  const getSigningChainId = async (): Promise<number | null> => {
    console.log('[useAssociationSigning] getSigningChainId:', { 
      isSmartWallet, 
      connectionChainId: chain?.id, 
      targetChain: baseSepolia.id 
    })
    
    // For smart wallets, get the connector's actual chain ID
    // This avoids the ConnectorChainMismatchError by signing on the connector's chain
    if (isSmartWallet && connector) {
      try {
        const connectorChainId = await connector.getChainId()
        console.log('[useAssociationSigning] Smart wallet connector chain:', connectorChainId)
        
        // Try to sync wagmi's connection state (may fail for smart wallets)
        if (chain?.id !== connectorChainId) {
          try {
            console.log('[useAssociationSigning] Attempting to sync connection to connector chain:', connectorChainId)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await switchChainAsync({ chainId: connectorChainId as any })
          } catch {
            // Switch failed, but we'll pass the connector's chain ID to sign anyway
            console.log('[useAssociationSigning] Chain sync failed, will pass chainId directly to sign')
          }
        }
        
        // Return the connector's chain ID to use in signing
        return connectorChainId
      } catch (err) {
        console.error('[useAssociationSigning] Failed to get connector chain:', err)
        // Fall back to connection chain
        return chain?.id ?? null
      }
    }

    // For EOA wallets, ensure we're on Base Sepolia
    if (chain?.id !== baseSepolia.id) {
      try {
        await switchChainAsync({ chainId: baseSepolia.id })
        return baseSepolia.id
      } catch (err) {
        console.error('[useAssociationSigning] Network switch failed:', err)
        const errorMsg = err instanceof Error ? err.message : ''
        if (errorMsg.includes('does not match')) {
          setError('Please switch to Base Sepolia in your wallet app, or try connecting with a different wallet')
        } else {
          setError('Please switch to Base Sepolia network to continue')
        }
        return null
      }
    }
    return baseSepolia.id
  }

  /**
   * Sign typed data directly using the connector's provider.
   * This bypasses wagmi's chain validation which causes ConnectorChainMismatchError
   * when the connection chain differs from the connector chain.
   */
  const signTypedDataDirect = async (): Promise<Hex> => {
    if (!connector || !address) {
      throw new Error('No connector or address available')
    }

    // Get the provider directly from the connector
    const provider = await connector.getProvider()
    
    // Build the typed data request in eth_signTypedData_v4 format
    // Must include EIP712Domain type explicitly
    const typedData = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
        ],
        ...ASSOCIATED_ACCOUNT_RECORD_TYPES,
      },
      primaryType: 'AssociatedAccountRecord',
      domain: EIP712_DOMAIN,
      message: {
        initiator: aar.initiator,
        approver: aar.approver,
        validAt: Number(aar.validAt),
        validUntil: Number(aar.validUntil),
        interfaceId: aar.interfaceId,
        data: aar.data,
      },
    }

    console.log('[useAssociationSigning] Signing directly with connector provider')

    // Use eth_signTypedData_v4 directly via the provider
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const signature = await (provider as any).request({
      method: 'eth_signTypedData_v4',
      params: [address, JSON.stringify(typedData)],
    })

    return signature as Hex
  }

  /**
   * Determine the appropriate key type based on signature format and on-chain state.
   * 
   * Key types:
   * - ERC6492: Smart wallet signature when contract is not yet deployed (counterfactual)
   * - ERC1271: Smart wallet signature when contract is deployed
   * - K1: Standard EOA signature (secp256k1)
   * 
   * Detection priority:
   * 1. If signature has ERC-6492 magic suffix → ERC6492 (undeployed smart wallet)
   * 2. If address has bytecode on-chain → ERC1271 (deployed smart wallet)
   * 3. Otherwise → K1 (EOA)
   * 
   * @param signature - The signature to analyze
   */
  const getKeyTypeForSignature = async (signature?: Hex): Promise<number> => {
    // 1. Check if signature has ERC-6492 magic suffix
    // This is definitive - only ERC-6492 wrapped signatures have this suffix
    if (signature && isErc6492Signature(signature)) {
      return KEY_TYPES.ERC6492
    }

    // 2. Check if address has bytecode (is a deployed smart contract)
    if (address && publicClient) {
      try {
        const isContract = await isSmartContract(publicClient, address)
        if (isContract) {
          return KEY_TYPES.ERC1271
        }
      } catch {
        // Ignore errors, fall through to K1
      }
    }

    // 3. No ERC-6492 magic bytes and no deployed bytecode = standard EOA
    return KEY_TYPES.K1
  }

  const handleSignInitiator = async () => {
    setIsProcessing(true)
    setError(null)
    try {
      let signature: Hex

      // For smart wallets, sign directly with the connector to bypass wagmi's chain validation
      if (isSmartWallet && connector) {
        console.log('[useAssociationSigning] Using direct signing for smart wallet initiator')
        signature = await signTypedDataDirect()
      } else {
        // For EOA wallets, use wagmi's signTypedData (handles chain switching)
        const signingChainId = await getSigningChainId()
        if (signingChainId === null) {
          setIsProcessing(false)
          return
        }
        
        console.log('[useAssociationSigning] Signing initiator with wagmi:', { 
          signingChainId,
          connectionChainId: chain?.id,
        })
        
        signature = await signTypedDataAsync({
          domain: EIP712_DOMAIN,
          types: ASSOCIATED_ACCOUNT_RECORD_TYPES,
          primaryType: 'AssociatedAccountRecord' as const,
          message: {
            initiator: aar.initiator,
            approver: aar.approver,
            validAt: Number(aar.validAt),
            validUntil: Number(aar.validUntil),
            interfaceId: aar.interfaceId,
            data: aar.data,
          },
        })
      }

      // Determine key type AFTER signing - this allows us to detect ERC-6492 wrapped signatures
      const keyType = await getKeyTypeForSignature(signature)

      setSar({
        ...sar,
        initiatorSignature: signature,
        initiatorKeyType: keyType,
      })
      // Disconnect so user can connect approver wallet
      disconnect()
      setFlowStep('connect-approver')
    } catch (err) {
      console.error('[useAssociationSigning] Sign initiator error:', err, { isSmartWallet, chain })
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('rejected the request')) {
        setError('User rejected the signature request')
      } else if (msg.includes('does not match') && !isSmartWallet) {
        // Only suggest network switch for non-smart wallets
        setError('Please switch to Base Sepolia in your wallet app')
      } else if (isSmartWallet && (msg.includes('does not match') || msg.includes('chain'))) {
        // Smart wallet signing issue - provide more context
        setError('Smart wallet signing failed. Try reconnecting or using a different chain in your wallet.')
      } else {
        setError(err instanceof Error ? err.message : 'Signing failed')
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSignApprover = async () => {
    setIsProcessing(true)
    setError(null)
    try {
      let signature: Hex

      // For smart wallets, sign directly with the connector to bypass wagmi's chain validation
      if (isSmartWallet && connector) {
        console.log('[useAssociationSigning] Using direct signing for smart wallet approver')
        signature = await signTypedDataDirect()
      } else {
        // For EOA wallets, use wagmi's signTypedData (handles chain switching)
        const signingChainId = await getSigningChainId()
        if (signingChainId === null) {
          setIsProcessing(false)
          return
        }
        
        console.log('[useAssociationSigning] Signing approver with wagmi:', { 
          signingChainId,
          connectionChainId: chain?.id,
        })
        
        signature = await signTypedDataAsync({
          domain: EIP712_DOMAIN,
          types: ASSOCIATED_ACCOUNT_RECORD_TYPES,
          primaryType: 'AssociatedAccountRecord' as const,
          message: {
            initiator: aar.initiator,
            approver: aar.approver,
            validAt: Number(aar.validAt),
            validUntil: Number(aar.validUntil),
            interfaceId: aar.interfaceId,
            data: aar.data,
          },
        })
      }

      // Determine key type AFTER signing - this allows us to detect ERC-6492 wrapped signatures
      const keyType = await getKeyTypeForSignature(signature)

      setSar({
        ...sar,
        approverSignature: signature,
        approverKeyType: keyType,
      })
      setFlowStep('store-association')
    } catch (err) {
      console.error('[useAssociationSigning] Sign approver error:', err, { isSmartWallet, chain })
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('rejected the request')) {
        setError('User rejected the signature request')
      } else if (msg.includes('does not match') && !isSmartWallet) {
        // Only suggest network switch for non-smart wallets
        setError('Please switch to Base Sepolia in your wallet app')
      } else if (isSmartWallet && (msg.includes('does not match') || msg.includes('chain'))) {
        // Smart wallet signing issue - provide more context
        setError('Smart wallet signing failed. Try reconnecting or using a different chain in your wallet.')
      } else {
        setError(err instanceof Error ? err.message : 'Signing failed')
      }
    } finally {
      setIsProcessing(false)
    }
  }

  return {
    isProcessing,
    handleSignInitiator,
    handleSignApprover,
  }
}
