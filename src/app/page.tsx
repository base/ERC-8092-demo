'use client'

import { useState, useCallback } from 'react'
import { Demo } from '@/components/Demo'
import { AssociationsGraph } from '@/components/AssociationsGraph'
import { RecordDisplay } from '@/components/RecordDisplay'
import { 
  type AssociatedAccountRecord, 
  type SignedAssociationRecord,
  createEmptyAAR,
  createEmptySAR 
} from '@/lib/types'

type TabMode = 'write' | 'read'

export default function Home() {
  // Active tab state
  const [activeTab, setActiveTab] = useState<TabMode>('write')
  
  // Completely separate state for write mode (creating new associations)
  const [writeAar, setWriteAar] = useState<AssociatedAccountRecord>(createEmptyAAR())
  const [writeSar, setWriteSar] = useState<SignedAssociationRecord>(createEmptySAR())
  
  // Completely separate state for read mode (viewing existing associations)
  const [readAar, setReadAar] = useState<AssociatedAccountRecord>(createEmptyAAR())
  const [readSar, setReadSar] = useState<SignedAssociationRecord>(createEmptySAR())
  
  // Graph refresh trigger - increment to cause refetch
  const [graphRefreshTrigger, setGraphRefreshTrigger] = useState(0)

  const scrollToDemo = () => {
    const demoSection = document.getElementById('demo-section')
    if (demoSection) {
      demoSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Handle association selection from the graph - switches to read tab
  const handleAssociationSelect = useCallback((selectedAar: AssociatedAccountRecord, selectedSar: SignedAssociationRecord) => {
    setReadAar(selectedAar)
    setReadSar(selectedSar)
    setActiveTab('read')
  }, [])

  // Handle write activity from Demo - switches to write tab
  const handleWriteActivity = useCallback(() => {
    if (activeTab !== 'write') {
      setActiveTab('write')
    }
  }, [activeTab])

  // Handle store completion - refresh graph after delay
  const handleStoreComplete = useCallback((storageMethod: 'onchain' | 'database') => {
    // Delay refresh to allow for block inclusion (longer for onchain)
    const delay = storageMethod === 'onchain' ? 3000 : 500
    setTimeout(() => {
      setGraphRefreshTrigger(prev => prev + 1)
    }, delay)
  }, [])

  // Get the current AAR/SAR based on active tab
  const displayAar = activeTab === 'write' ? writeAar : readAar
  const displaySar = activeTab === 'write' ? writeSar : readSar

  return (
    <div className="page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">ERC-8092</h1>
          <p className="hero-subtitle">Associated Accounts</p>
          <p className="hero-description">
            A standard for establishing and verifying associations between blockchain accounts. 
            Publicly declare, prove, and revoke relationships between addresses with cryptographic guarantees.
          </p>
          <div className="hero-buttons">
            <button onClick={scrollToDemo} className="try-demo-btn">
              Demo
              <span className="arrow">↓</span>
            </button>
            <a 
              href="https://github.com/ethereum/ERCs/pull/1377" 
              target="_blank" 
              rel="noopener noreferrer"
              className="spec-link"
            >
              Spec
              <span className="arrow">↗</span>
            </a>
            <a 
              href="https://ethereum-magicians.org/t/erc-8092-associated-accounts/26858" 
              target="_blank" 
              rel="noopener noreferrer"
              className="spec-link"
            >
              Forum
              <span>🧙</span>
            </a>
            <a 
              href="https://t.me/+7KAruLeFrJgzZDIx" 
              target="_blank" 
              rel="noopener noreferrer"
              className="spec-link"
            >
              Telegram
              <span>✈️</span>
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <div className="orbit-container">
            <div className="orbit orbit-1"></div>
            <div className="orbit orbit-2"></div>
            <div className="center-node"></div>
            <div className="satellite satellite-1"></div>
            <div className="satellite satellite-2"></div>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo-section" className="demo-section">
        <div className="demo-header">
          <h3>Associate two wallets you control using ERC-8092</h3>
        </div>
        
        <div className="demo-container">
          <div className="demo-panels">
            {/* Left panel: Control Panel (always shows write controls) */}
            <aside className="left-panel">
              <Demo 
                externalAar={writeAar}
                externalSar={writeSar}
                onAarChange={setWriteAar}
                onSarChange={setWriteSar}
                onWriteActivity={handleWriteActivity}
                onStoreComplete={handleStoreComplete}
              />
            </aside>
            
            {/* Right panel: Tabbed AAR/SAR display */}
            <main className="right-panel">
              <div className="record-panel-box">
                {/* Tab buttons */}
                <div className="record-tabs">
                  <button 
                    className={`record-tab ${activeTab === 'write' ? 'active' : ''}`}
                    onClick={() => setActiveTab('write')}
                  >
                    <span className="tab-icon">✏️</span>
                    Write
                  </button>
                  <button 
                    className={`record-tab ${activeTab === 'read' ? 'active' : ''}`}
                    onClick={() => setActiveTab('read')}
                  >
                    <span className="tab-icon">👁️</span>
                    Read
                  </button>
                </div>
                
                {/* Record display shows data based on active tab */}
                <RecordDisplay aar={displayAar} sar={displaySar} />
                
                {/* Read tab hint when empty */}
                {activeTab === 'read' && readAar.initiator === '0x' && (
                  <div className="read-tab-hint">
                    <p>Click an association in the graph below to view its details</p>
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
        
        <AssociationsGraph 
          onAssociationSelect={handleAssociationSelect}
          refreshTrigger={graphRefreshTrigger}
        />
      </section>
    </div>
  )
}
