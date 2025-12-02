'use client'

import { useState } from 'react'
import { useSignTypedData, useDisconnect } from 'wagmi'
import type { AssociatedAccountRecord, SignedAssociationRecord, FlowStep } from '@/lib/types'
import { KEY_TYPES } from '@/lib/types'
import { EIP712_DOMAIN, ASSOCIATED_ACCOUNT_RECORD_TYPES } from '@/lib/eip712'

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
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSignInitiator = async () => {
    setIsProcessing(true)
    setError(null)
    try {
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
      setSar({
        ...sar,
        initiatorSignature: signature,
        initiatorKeyType: KEY_TYPES.K1,
      })
      // Disconnect so user can connect approver wallet
      disconnect()
      setFlowStep('connect-approver')
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('rejected the request')) {
        setError('User rejected the signature request')
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
      setSar({
        ...sar,
        approverSignature: signature,
        approverKeyType: KEY_TYPES.K1,
      })
      setFlowStep('store-association')
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('rejected the request')) {
        setError('User rejected the signature request')
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

