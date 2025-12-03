'use client'

import { useEffect, useState } from 'react'
import { type Hex, toHex, decodeEventLog } from 'viem'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import type { AssociatedAccountRecord, SignedAssociationRecord, FlowStep } from '@/lib/types'
import { ASSOCIATIONS_STORE_ADDRESS, associationsStoreAbi } from '@/lib/contracts'

interface UseAssociationStorageProps {
  aar: AssociatedAccountRecord
  sar: SignedAssociationRecord
  flowStep: FlowStep
  setFlowStep: (step: FlowStep) => void
  setError: (error: string | null) => void
}

export function useAssociationStorage({
  aar,
  sar,
  flowStep,
  setFlowStep,
  setError,
}: UseAssociationStorageProps) {
  const [associationId, setAssociationId] = useState<Hex | null>(null)
  const { writeContract, data: txHash, isPending: isWritePending, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed, data: receipt } = useWaitForTransactionReceipt({ hash: txHash })

  // Helper to convert key type number to bytes2 hex
  const keyTypeToBytes2 = (keyType: number): Hex => {
    return toHex(keyType, { size: 2 })
  }

  // Handle transaction confirmation and extract association ID from logs
  useEffect(() => {
    if (isConfirmed && flowStep === 'store-association') {
      // Extract association ID from the AssociationCreated event
      if (receipt?.logs) {
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: associationsStoreAbi,
              data: log.data,
              topics: log.topics,
            })
            if (decoded.eventName === 'AssociationCreated') {
              // The first indexed topic after the event signature is the hash (association ID)
              const id = log.topics[1] as Hex
              setAssociationId(id)
              break
            }
          } catch {
            // Not the event we're looking for, continue
          }
        }
      }
      setFlowStep('complete')
    }
  }, [isConfirmed, flowStep, setFlowStep, receipt])

  // Handle write errors
  useEffect(() => {
    if (writeError) {
      // Check for user rejection patterns
      const msg = writeError.message.toLowerCase()
      if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('rejected the request')) {
        setError('User rejected the transaction')
      } else {
        // Truncate long error messages
        const shortMsg = writeError.message.length > 100 
          ? writeError.message.slice(0, 100) + '...'
          : writeError.message
        setError(shortMsg)
      }
    }
  }, [writeError, setError])

  const handleStoreAssociation = () => {
    setError(null)
    
    // Build the contract struct matching the Solidity types
    // Note: revokedAt must be 0 when storing a new association
    const contractSar = {
      revokedAt: 0,
      initiatorKeyType: keyTypeToBytes2(sar.initiatorKeyType),
      approverKeyType: keyTypeToBytes2(sar.approverKeyType),
      initiatorSignature: sar.initiatorSignature,
      approverSignature: sar.approverSignature,
      record: {
        initiator: aar.initiator,
        approver: aar.approver,
        validAt: Number(aar.validAt),
        validUntil: Number(aar.validUntil),
        interfaceId: aar.interfaceId,
        data: aar.data,
      },
    }

    writeContract({
      address: ASSOCIATIONS_STORE_ADDRESS,
      abi: associationsStoreAbi,
      functionName: 'storeAssociation',
      args: [contractSar],
    })
  }

  return {
    txHash,
    isWritePending,
    isConfirming,
    associationId,
    handleStoreAssociation,
  }
}

