'use client'

import { useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import type { SignedAssociationRecord } from '@/lib/types'

interface UseDatabaseRevocationProps {
  associationId: number | null
  sar: SignedAssociationRecord
  setSar: (sar: SignedAssociationRecord) => void
  setError: (error: string | null) => void
}

interface UseDatabaseRevocationReturn {
  isRevoking: boolean
  isRevoked: boolean
  handleRevoke: (revokedAt?: number) => Promise<void>
}

export function useDatabaseRevocation({
  associationId,
  sar,
  setSar,
  setError,
}: UseDatabaseRevocationProps): UseDatabaseRevocationReturn {
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  
  const [isRevoking, setIsRevoking] = useState(false)
  const [isRevoked, setIsRevoked] = useState(false)

  const handleRevoke = async (revokedAt?: number) => {
    if (!associationId) {
      setError('No association ID available')
      return
    }

    if (!address) {
      setError('Wallet not connected')
      return
    }

    setError(null)
    setIsRevoking(true)

    try {
      // Create the revocation message to sign
      const timestamp = revokedAt ?? Math.floor(Date.now() / 1000)
      const message = `Revoke association ${associationId} at timestamp ${timestamp}`

      // Request signature from user
      const signature = await signMessageAsync({ message })

      // Send revocation request with signature
      const response = await fetch('/api/associations', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: associationId,
          revokedAt: timestamp,
          message,
          signature,
          signer: address,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to revoke association')
      }

      // Update local state
      setSar({
        ...sar,
        revokedAt: BigInt(timestamp),
      })
      setIsRevoked(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      // Check for user rejection
      if (message.toLowerCase().includes('user rejected') || 
          message.toLowerCase().includes('user denied')) {
        setError('User rejected the signature request')
      } else {
        setError(message)
      }
    } finally {
      setIsRevoking(false)
    }
  }

  return {
    isRevoking,
    isRevoked,
    handleRevoke,
  }
}

