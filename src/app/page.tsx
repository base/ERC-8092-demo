'use client'

import { useState, useCallback } from 'react'
import { FaTelegramPlane, FaGithub } from 'react-icons/fa'
import { Demo } from '@/components/Demo'
import { AssociationsGraph, type AssociationSelectData } from '@/components/AssociationsGraph'
import { RecordDisplay } from '@/components/RecordDisplay'
import { useWalletConnection } from '@/hooks'
import { extractAddress } from '@/lib/erc7930'
import { 
  type AssociatedAccountRecord, 
  type SignedAssociationRecord,
  createEmptyAAR,
  createEmptySAR 
} from '@/lib/types'

type TabMode = 'write' | 'read'

export default function Home() {
  // Wallet connection state to determine revocation permissions
  const { isConnected, address: connectedAddress } = useWalletConnection()
  
  // Tab navigation state
  const [activeTab, setActiveTab] = useState<TabMode>('write')
  
  // Independent state management for the 'write' mode (creating associations)
  const [writeAar, setWriteAar] = useState<AssociatedAccountRecord>(createEmptyAAR())
  const [writeSar, setWriteSar] = useState<SignedAssociationRecord>(createEmptySAR())
  
  // Independent state management for the 'read' mode (inspecting associations)
  const [readAar, setReadAar] = useState<AssociatedAccountRecord>(createEmptyAAR())
  const [readSar, setReadSar] = useState<SignedAssociationRecord>(createEmptySAR())
  const [readSource, setReadSource] = useState<'onchain' | 'offchain' | null>(null)
  const [readAssociationId, setReadAssociationId] = useState<string | null>(null)
  
  // Trigger mechanism to force a re-fetch in the AssociationsGraph component
  const [graphRefreshTrigger, setGraphRefreshTrigger] = useState(0)
  
  // Trigger mechanism to initiate the revocation flow within the ControlPanel
  const [revokeModeTrigger, setRevokeModeTrigger] = useState(0)

  // Smooth scroll handler for the hero section CTA
  const scrollToDemo = () => {
    const demoSection = document.getElementById('demo-section')
    if (demoSection) {
      demoSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Callback triggered when a node/edge is clicked in the Cytoscape graph
  const handleAssociationSelect = useCallback((data: AssociationSelectData) => {
    setReadAar(data.aar)
    setReadSar(data.sar)
    setReadSource(data.source)
    setReadAssociationId(data.id)
    setActiveTab('read')
  }, [])

  // Callback to force switch to write tab when user interacts with the Demo panel
  const handleWriteActivity = useCallback(() => {
    if (activeTab !== 'write') {
      setActiveTab('write')
    }
  }, [activeTab])

  // Lifecycle hook for successful storage operations (triggers graph refresh)
  const handleStoreComplete = useCallback((storageMethod: 'onchain' | 'database') => {
    // Delay accommodates block confirmation times vs immediate DB writes
    const delay = storageMethod === 'onchain' ? 3000 : 500
    setTimeout(() => {
      setGraphRefreshTrigger(prev => prev + 1)
    }, delay)
  }, [])

  // Lifecycle hook for successful revocation (triggers graph refresh)
  const handleRevokeComplete = useCallback(() => {
    setTimeout(() => {
      setGraphRefreshTrigger(prev => prev + 1)
    }, 500)
  }, [])

  // Bootstraps the revocation workflow by copying read state to write state
  const handleInitiateRevoke = useCallback(() => {
    if (!readSource || !readAssociationId) return
    
    setWriteAar(readAar)
    setWriteSar(readSar)
    
    setActiveTab('write')
    setRevokeModeTrigger(prev => prev + 1)
  }, [readAar, readSar, readSource, readAssociationId])

  // Validates whether the currently connected wallet has authorization to revoke the active record
  const canRevoke = useCallback(() => {
    if (!isConnected || !connectedAddress || !readAar.initiator || readAar.initiator === '0x') {
      return false
    }
    if (readSar.revokedAt > 0n) {
      return false // Record is already invalidated
    }
    
    const initiatorAddr = extractAddress(readAar.initiator)?.toLowerCase()
    const approverAddr = extractAddress(readAar.approver)?.toLowerCase()
    const connected = connectedAddress.toLowerCase()
    
    return connected === initiatorAddr || connected === approverAddr
  }, [isConnected, connectedAddress, readAar, readSar])

  // Context-aware state resolution for the RecordDisplay component
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
              href="https://eip.tools/eip/8092" 
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
              <FaTelegramPlane style={{marginLeft: '6px'}} />
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
            {/* Left panel: Interactive control surface */}
            <aside className="left-panel">
              <Demo 
                externalAar={writeAar}
                externalSar={writeSar}
                onAarChange={setWriteAar}
                onSarChange={setWriteSar}
                onWriteActivity={handleWriteActivity}
                onStoreComplete={handleStoreComplete}
                onRevokeComplete={handleRevokeComplete}
                revokeModeTrigger={revokeModeTrigger}
                revokeSource={readSource}
                revokeAssociationId={readAssociationId}
              />
            </aside>
            
            {/* Right panel: Data visualization and tabbed interface */}
            <main className="right-panel">
              <div className="record-panel-box">
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
                
                {/* Dynamically renders AAR/SAR based on the active tab context */}
                <RecordDisplay aar={displayAar} sar={displaySar} />
                
                {activeTab === 'read' && readAar.initiator === '0x' && (
                  <div className="read-tab-hint">
                    <p>Click an association in the graph below to view its details</p>
                  </div>
                )}
                
                {activeTab === 'read' && readAar.initiator !== '0x' && (
                  <div className="read-tab-actions">
                    {readSar.revokedAt > 0n ? (
                      <div className="revoked-badge">
                        <span>✕</span> This association has been revoked
                      </div>
                    ) : canRevoke() ? (
                      <button 
                        onClick={handleInitiateRevoke}
                        className="revoke-from-read-btn"
                      >
                        Revoke This Association
                      </button>
                    ) : isConnected ? (
                      <div className="cannot-revoke-hint">
                        Connect with initiator or approver wallet to revoke
                      </div>
                    ) : (
                      <div className="cannot-revoke-hint">
                        Connect wallet to revoke this association
                      </div>
                    )}
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

      {/* Footer */}
      <footer className="site-footer">
        <a 
          href="https://github.com/base/ERC-8092-demo" 
          target="_blank" 
          rel="noopener noreferrer"
          className="github-link"
        >
          <FaGithub size={24} />
          <span>View on GitHub</span>
        </a>
      </footer>
    </div>
  )
}