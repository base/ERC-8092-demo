'use client'

import { useState } from 'react'
import { ControlPanel } from './ControlPanel'
import { 
  type FlowStep, 
  type AssociatedAccountRecord, 
  type SignedAssociationRecord,
  createEmptyAAR,
  createEmptySAR 
} from '@/lib/types'

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
}

export function Demo({ externalAar, externalSar, onAarChange, onSarChange, onWriteActivity, onStoreComplete }: DemoProps) {
  const [flowStep, setFlowStep] = useState<FlowStep>('connect-initiator')
  const [internalAar, setInternalAar] = useState<AssociatedAccountRecord>(createEmptyAAR())
  const [internalSar, setInternalSar] = useState<SignedAssociationRecord>(createEmptySAR())

  // Use external state if provided, otherwise internal
  const aar = externalAar ?? internalAar
  const sar = externalSar ?? internalSar

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
    />
  )
}
