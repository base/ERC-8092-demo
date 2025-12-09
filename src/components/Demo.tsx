'use client'

import { useState, useEffect } from 'react'
import { hashTypedData } from 'viem'
import { ControlPanel } from './ControlPanel'
import { 
  type FlowStep, 
  type AssociatedAccountRecord, 
  type SignedAssociationRecord,
  createEmptyAAR,
  createEmptySAR 
} from '@/lib/types'
import { EIP712_DOMAIN, ASSOCIATED_ACCOUNT_RECORD_TYPES } from '@/lib/eip712'

interface DemoProps {
  /** Externally controlled AAR (optional - will use internal state if not provided) */
  externalAar?: AssociatedAccountRecord
  /** Externally controlled SAR (optional - will use internal state if not provided) */
  externalSar?: SignedAssociationRecord
  /** Callback when AAR changes */
  onAarChange?: (aar: AssociatedAccountRecord) => void
  /** Callback when SAR changes */
  onSarChange?: (sar: SignedAssociationRecord) => void
  /** Callback when user takes a write action (to switch tabs) */
  onWriteActivity?: () => void
  /** Callback when association is stored (to refresh graph) */
  onStoreComplete?: (storageMethod: 'onchain' | 'database') => void
  /** Callback when association is revoked (to refresh graph) */
  onRevokeComplete?: () => void
  /** Trigger to start revoke mode (increment to activate) */
  revokeModeTrigger?: number
  /** Source of the association to revoke */
  revokeSource?: 'onchain' | 'offchain' | null
  /** ID of the association to revoke */
  revokeAssociationId?: string | null
}

export function Demo({ 
  externalAar, 
  externalSar, 
  onAarChange, 
  onSarChange, 
  onWriteActivity, 
  onStoreComplete, 
  onRevokeComplete,
  revokeModeTrigger,
  revokeSource,
  revokeAssociationId,
}: DemoProps) {
  const [flowStep, setFlowStep] = useState<FlowStep>('connect-initiator')
  const [internalAar, setInternalAar] = useState<AssociatedAccountRecord>(createEmptyAAR())
  const [internalSar, setInternalSar] = useState<SignedAssociationRecord>(createEmptySAR())

  // Use external state if provided, otherwise internal
  const aar = externalAar ?? internalAar
  const sar = externalSar ?? internalSar

  // Debug: expose AAR/SAR to window for console debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any
      const message = {
        initiator: aar.initiator,
        approver: aar.approver,
        validAt: Number(aar.validAt),
        validUntil: Number(aar.validUntil),
        interfaceId: aar.interfaceId,
        data: aar.data,
      }
      win.DEBUG = {
        aar,
        sar,
        domain: EIP712_DOMAIN,
        types: ASSOCIATED_ACCOUNT_RECORD_TYPES,
        message,
        // Full EIP-712 typed data structure (JSON format wallets receive)
        typedData: {
          domain: EIP712_DOMAIN,
          types: ASSOCIATED_ACCOUNT_RECORD_TYPES,
          primaryType: 'AssociatedAccountRecord',
          message,
        },
        // Get JSON string of the typed data
        getTypedDataJSON: () => JSON.stringify({
          domain: EIP712_DOMAIN,
          types: ASSOCIATED_ACCOUNT_RECORD_TYPES,
          primaryType: 'AssociatedAccountRecord',
          message,
        }, null, 2),
        getTypedDataHash: () => hashTypedData({
          domain: EIP712_DOMAIN,
          types: ASSOCIATED_ACCOUNT_RECORD_TYPES,
          primaryType: 'AssociatedAccountRecord',
          message,
        }),
      }
    }
  }, [aar, sar])

  const setAar = (newAar: AssociatedAccountRecord) => {
    if (onAarChange) {
      onAarChange(newAar)
    } else {
      setInternalAar(newAar)
    }
  }

  const setSar = (newSar: SignedAssociationRecord) => {
    if (onSarChange) {
      onSarChange(newSar)
    } else {
      setInternalSar(newSar)
    }
  }

  return (
    <ControlPanel
      flowStep={flowStep}
      setFlowStep={setFlowStep}
      aar={aar}
      setAar={setAar}
      sar={sar}
      setSar={setSar}
      onWriteActivity={onWriteActivity}
      onStoreComplete={onStoreComplete}
      onRevokeComplete={onRevokeComplete}
      revokeModeTrigger={revokeModeTrigger}
      revokeSource={revokeSource}
      revokeAssociationId={revokeAssociationId}
    />
  )
}
