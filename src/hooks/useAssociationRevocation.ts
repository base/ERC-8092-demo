'use client'

import { useEffect } from 'react'
import { type Hex } from 'viem'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import type { SignedAssociationRecord } from '@/lib/types'
import { ASSOCIATIONS_STORE_ADDRESS, associationsStoreAbi } from '@/lib/contracts'

interface UseAssociationRevocationProps {
  associationId: Hex | null
  sar: SignedAssociationRecord
  setSar: (sar: SignedAssociationRecord) => void
  setError: (error: string | null) => void
}

export function useAssociationRevocation({
  associationId,
  sar,
  setSar,
  setError,
}: UseAssociationRevocationProps) {
  const { writeContract, data: txHash, isPending: isRevokePending, error: revokeError } = useWriteContract()
  const { isLoading: isRevokeConfirming, isSuccess: isRevokeConfirmed } = useWaitForTransactionReceipt({ hash: txHash })

  // Handle revocation confirmation - update local state
  useEffect(() => {
    if (isRevokeConfirmed) {
      const now = BigInt(Math.floor(Date.now() / 1000))
      setSar({
        ...sar,
        revokedAt: now,
      })
    }
  }, [isRevokeConfirmed, sar, setSar])

  // Handle revoke errors
  useEffect(() => {
    if (revokeError) {
      const msg = revokeError.message.toLowerCase()
      if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('rejected the request')) {
        setError('User rejected the transaction')
      } else {
        const shortMsg = revokeError.message.length > 100 
          ? revokeError.message.slice(0, 100) + '...'
          : revokeError.message
        setError(shortMsg)
      }
    }
  }, [revokeError, setError])

  const handleRevoke = (revokedAt?: number) => {
    if (!associationId) {
      setError('No association ID available. Store the association first.')
      return
    }

    setError(null)
    
    // Use provided timestamp or 0 for immediate revocation
    const effectiveRevokedAt = revokedAt ?? 0

    writeContract({
      address: ASSOCIATIONS_STORE_ADDRESS,
      abi: associationsStoreAbi,
      functionName: 'revokeAssociation',
      args: [associationId, effectiveRevokedAt],
    })
  }

  return {
    revokeTxHash: txHash,
    isRevokePending,
    isRevokeConfirming,
    isRevokeConfirmed,
    handleRevoke,
  }
}
