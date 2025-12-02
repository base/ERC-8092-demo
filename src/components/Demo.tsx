'use client'

import { useState } from 'react'
import { ControlPanel } from './ControlPanel'
import { RecordDisplay } from './RecordDisplay'
import { 
  type FlowStep, 
  type AssociatedAccountRecord, 
  type SignedAssociationRecord,
  createEmptyAAR,
  createEmptySAR 
} from '@/lib/types'

export function Demo() {
  const [flowStep, setFlowStep] = useState<FlowStep>('connect-initiator')
  const [aar, setAar] = useState<AssociatedAccountRecord>(createEmptyAAR())
  const [sar, setSar] = useState<SignedAssociationRecord>(createEmptySAR())

  return (
    <div className="demo-container">
      <div className="demo-panels">
        <aside className="left-panel">
          <ControlPanel
            flowStep={flowStep}
            setFlowStep={setFlowStep}
            aar={aar}
            setAar={setAar}
            sar={sar}
            setSar={setSar}
          />
        </aside>
        <main className="right-panel">
          <RecordDisplay aar={aar} sar={sar} />
        </main>
      </div>
    </div>
  )
}

