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
  const { address, chain } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { isSmartWallet } = useSmartWallet()
  // Always use Base Sepolia for contract detection regardless of wallet's current chain
  const publicClient = usePublicClient({ chainId: baseSepolia.id })
  const [isProcessing, setIsProcessing] = useState(false)

  /**
   * Ensure wallet is connected to Base Sepolia before proceeding.
   * For smart wallets that aren't deployed on Base Sepolia, we skip the switch
   * since EIP-712 signatures without chainId are chain-agnostic.
   */
  const ensureCorrectNetwork = async (): Promise<boolean> => {
    // Smart wallets may not be deployed on Base Sepolia yet
    // Since our EIP-712 domain doesn't include chainId, signatures are chain-agnostic
    // Skip network switch for smart wallet connectors to avoid deployment issues
    if (isSmartWallet) {
      return true
    }

    if (chain?.id !== baseSepolia.id) {
      try {
        await switchChainAsync({ chainId: baseSepolia.id })
        return true
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : ''
        if (errorMsg.includes('does not match')) {
          setError('Please switch to Base Sepolia in your wallet app, or try connecting with a different wallet')
        } else {
          setError('Please switch to Base Sepolia network to continue')
        }
        return false
      }
    }
    return true
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
      // Ensure wallet is on Base Sepolia (skipped for smart wallets)
      const isCorrectNetwork = await ensureCorrectNetwork()
      if (!isCorrectNetwork) {
        setIsProcessing(false)
        return
      }
      
      const signature = await signTypedDataAsync({
        domain: EIP712_DOMAIN,
        types: ASSOCIATED_ACCOUNT_RECORD_TYPES,
        primaryType: 'AssociatedAccountRecord',
        message: {
          initiator: aar.initiator,
          approver: aar.approver,
          validAt: Number(aar.validAt),
          validUntil: Number(aar.validUntil),
          interfaceId: aar.interfaceId,
          data: aar.data,
        },
      })

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
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('rejected the request')) {
        setError('User rejected the signature request')
      } else if (msg.includes('does not match')) {
        setError('Please switch to Base Sepolia in your wallet app')
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
      // Ensure wallet is on Base Sepolia (skipped for smart wallets)
      const isCorrectNetwork = await ensureCorrectNetwork()
      if (!isCorrectNetwork) {
        setIsProcessing(false)
        return
      }
      
      const signature = await signTypedDataAsync({
        domain: EIP712_DOMAIN,
        types: ASSOCIATED_ACCOUNT_RECORD_TYPES,
        primaryType: 'AssociatedAccountRecord',
        message: {
          initiator: aar.initiator,
          approver: aar.approver,
          validAt: Number(aar.validAt),
          validUntil: Number(aar.validUntil),
          interfaceId: aar.interfaceId,
          data: aar.data,
        },
      })

      // Determine key type AFTER signing - this allows us to detect ERC-6492 wrapped signatures
      const keyType = await getKeyTypeForSignature(signature)

      setSar({
        ...sar,
        approverSignature: signature,
        approverKeyType: keyType,
      })
      setFlowStep('store-association')
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('rejected the request')) {
        setError('User rejected the signature request')
      } else if (msg.includes('does not match')) {
        setError('Please switch to Base Sepolia in your wallet app')
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
