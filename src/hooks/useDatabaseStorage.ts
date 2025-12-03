'use client'

import { useState } from 'react'
import type { AssociatedAccountRecord, SignedAssociationRecord, FlowStep } from '@/lib/types'

interface UseDatabaseStorageProps {
  aar: AssociatedAccountRecord
  sar: SignedAssociationRecord
  flowStep: FlowStep
  setFlowStep: (step: FlowStep) => void
  setError: (error: string | null) => void
}

interface UseDatabaseStorageReturn {
  associationId: number | null
  isStoring: boolean
  handleStoreAssociation: () => Promise<void>
}

export function useDatabaseStorage({
  aar,
  sar,
  setFlowStep,
  setError,
}: UseDatabaseStorageProps): UseDatabaseStorageReturn {
  const [associationId, setAssociationId] = useState<number | null>(null)
  const [isStoring, setIsStoring] = useState(false)

  const handleStoreAssociation = async () => {
    setError(null)
    setIsStoring(true)

    try {
      const response = await fetch('/api/associations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aar: {
            initiator: aar.initiator,
            approver: aar.approver,
            validAt: aar.validAt.toString(),
            validUntil: aar.validUntil.toString(),
            interfaceId: aar.interfaceId,
            data: aar.data,
          },
          sar: {
            // revokedAt must be 0 when storing a new association
            revokedAt: '0',
            initiatorKeyType: sar.initiatorKeyType,
            approverKeyType: sar.approverKeyType,
            initiatorSignature: sar.initiatorSignature,
            approverSignature: sar.approverSignature,
          },
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to store association')
      }

      setAssociationId(result.associationId)
      setFlowStep('complete')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setError(message)
    } finally {
      setIsStoring(false)
    }
  }

  return {
    associationId,
    isStoring,
    handleStoreAssociation,
  }
}

