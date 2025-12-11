'use client'

import { useState, useEffect } from 'react'
import { type Address, type Hex, isAddress, isHex } from 'viem'
import { useEnsAddress } from 'wagmi'
import { baseSepolia, mainnet } from 'wagmi/chains'
import type { FlowStep, AssociatedAccountRecord, SignedAssociationRecord } from '@/lib/types'
import { addressToErc7930 } from '@/lib/types'
import { useWalletConnection, useAssociationSigning, useAssociationStorage, useDatabaseStorage, useAssociationRevocation, useDatabaseRevocation } from '@/hooks'

interface ControlPanelProps {
  flowStep: FlowStep
  setFlowStep: (step: FlowStep) => void
  aar: AssociatedAccountRecord
  setAar: (aar: AssociatedAccountRecord) => void
  sar: SignedAssociationRecord
  setSar: (sar: SignedAssociationRecord) => void
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

export function ControlPanel({ 
  flowStep, 
  setFlowStep, 
  aar, 
  setAar, 
  sar, 
  setSar,
  onWriteActivity,
  onStoreComplete,
  onRevokeComplete,
  revokeModeTrigger = 0,
  revokeSource,
  revokeAssociationId,
}: ControlPanelProps) {
  // Local state
  const [approverInput, setApproverInput] = useState('')
  const [initiatorAddress, setInitiatorAddress] = useState<Address | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [awaitingInitiatorConnect, setAwaitingInitiatorConnect] = useState(true)
  const [awaitingApproverConnect, setAwaitingApproverConnect] = useState(false)
  
  // Storage method selection
  const [storageMethod, setStorageMethod] = useState<'onchain' | 'database'>('onchain')
  
  // External association ID (for revoking existing associations)
  const [externalAssociationId, setExternalAssociationId] = useState<string | null>(null)
  const [isRevokingExisting, setIsRevokingExisting] = useState(false)
  
  // Optional AAR fields
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [validUntilInput, setValidUntilInput] = useState('')
  const [interfaceIdInput, setInterfaceIdInput] = useState('')
  const [dataInput, setDataInput] = useState('')

  // Custom hooks
  const {
    isConnected,
    address,
    chainId,
    chainName,
    isWrongChain,
    isSmartWallet,
    isSwitchingChain,
    handleConnect,
    handleDisconnect,
    handleSwitchNetwork,
  } = useWalletConnection()

  const {
    isProcessing,
    handleSignInitiator,
    handleSignApprover,
  } = useAssociationSigning({
    aar,
    sar,
    setSar,
    setFlowStep,
    setError,
  })

  const onchainStorage = useAssociationStorage({
    aar,
    sar,
    flowStep,
    setFlowStep,
    setError,
  })

  const databaseStorage = useDatabaseStorage({
    aar,
    sar,
    flowStep,
    setFlowStep,
    setError,
  })

  // Use the appropriate storage based on selection
  const {
    txHash,
    isWritePending,
    isConfirming,
    associationId: onchainAssociationId,
    handleStoreAssociation: handleStoreOnchain,
  } = onchainStorage

  const {
    associationId: dbAssociationId,
    isStoring,
    handleStoreAssociation: handleStoreDatabase,
  } = databaseStorage

  // Unified storage handler
  const handleStoreAssociation = storageMethod === 'onchain' 
    ? handleStoreOnchain 
    : handleStoreDatabase
  
  const isStorePending = storageMethod === 'onchain' 
    ? (isWritePending || isConfirming) 
    : isStoring
  
  const associationId = storageMethod === 'onchain' 
    ? onchainAssociationId 
    : (dbAssociationId?.toString() ?? null)

  // ENS resolution - if it's not a valid address, try to resolve it as an ENS name
  const isEnsName = !isAddress(approverInput) && approverInput.length > 0
  const { data: resolvedAddress, isLoading: isResolvingEns } = useEnsAddress({
    name: isEnsName ? approverInput : undefined,
    chainId: mainnet.id,
  })

  // Onchain revocation (uses Hex association ID)
  const {
    revokeTxHash,
    isRevokePending,
    isRevokeConfirming,
    handleRevoke: handleOnchainRevoke,
  } = useAssociationRevocation({
    associationId: onchainAssociationId,
    sar,
    setSar,
    setError,
  })

  // Compute effective database association ID (from storage hook or external)
  const effectiveDbAssociationId = isRevokingExisting && externalAssociationId?.startsWith('db-')
    ? parseInt(externalAssociationId.replace('db-', ''), 10)
    : dbAssociationId

  // Database revocation (uses numeric ID, requires signature)
  const {
    isRevoking: isDbRevoking,
    handleRevoke: handleDatabaseRevoke,
  } = useDatabaseRevocation({
    associationId: effectiveDbAssociationId,
    sar,
    setSar,
    setError,
    onSuccess: onRevokeComplete,
  })

  // The effective approver address (resolved ENS or raw input)
  const effectiveApproverAddress: Address | null = resolvedAddress ?? (isAddress(approverInput) ? approverInput as Address : null)

  // Check if approver matches initiator
  const isSameAsInitiator = !!(initiatorAddress && effectiveApproverAddress && 
    effectiveApproverAddress.toLowerCase() === initiatorAddress.toLowerCase())

  // Track when wallet disconnects so we can detect new connections
  useEffect(() => {
    if (!isConnected) {
      if (flowStep === 'connect-initiator') {
        setAwaitingInitiatorConnect(true)
      }
      if (flowStep === 'connect-approver') {
        setAwaitingApproverConnect(true)
      }
    }
  }, [flowStep, isConnected])

  // Handle initiator connection - only advance after fresh connection
  useEffect(() => {
    if (flowStep === 'connect-initiator' && isConnected && address && awaitingInitiatorConnect) {
      setInitiatorAddress(address)
      setAwaitingInitiatorConnect(false)
      setAar({
        ...aar,
        initiator: addressToErc7930(address, baseSepolia.id),
      })
      setFlowStep('input-approver')
    }
  }, [flowStep, isConnected, address, awaitingInitiatorConnect, setFlowStep, setAar, aar])

  // Update initiator if wallet changes before signing (e.g., user disconnects and connects different wallet)
  useEffect(() => {
    if (flowStep === 'input-approver' && isConnected && address && initiatorAddress) {
      // If the connected address is different from the stored initiator, update it
      if (address.toLowerCase() !== initiatorAddress.toLowerCase()) {
        setInitiatorAddress(address)
        setAar({
          ...aar,
          initiator: addressToErc7930(address, baseSepolia.id),
        })
      }
    }
  }, [flowStep, isConnected, address, initiatorAddress, setAar, aar])

  // Handle approver connection - only validate after we see a NEW connection
  useEffect(() => {
    if (flowStep === 'connect-approver' && isConnected && address && awaitingApproverConnect && effectiveApproverAddress) {
      if (address.toLowerCase() !== effectiveApproverAddress.toLowerCase()) {
        setError('Wrong wallet. Connect the approver address.')
      } else {
        setError(null)
        setFlowStep('sign-approver')
      }
      setAwaitingApproverConnect(false)
    }
  }, [flowStep, isConnected, address, effectiveApproverAddress, awaitingApproverConnect, setFlowStep])

  // Notify parent when store completes (to refresh graph)
  useEffect(() => {
    if (flowStep === 'complete' && onStoreComplete) {
      onStoreComplete(storageMethod)
    }
  }, [flowStep, onStoreComplete, storageMethod])

  // Handle revoke mode trigger from external (Read tab)
  useEffect(() => {
    if (revokeModeTrigger > 0 && revokeSource && revokeAssociationId) {
      // Set up for revoking an existing association
      setStorageMethod(revokeSource === 'onchain' ? 'onchain' : 'database')
      setExternalAssociationId(revokeAssociationId)
      setIsRevokingExisting(true)
      setFlowStep('revoke-existing')
      setError(null)
    }
  }, [revokeModeTrigger, revokeSource, revokeAssociationId, setFlowStep])

  const handleSubmitApprover = () => {
    if (!initiatorAddress) {
      setError('Initiator address not set')
      return
    }
    if (!effectiveApproverAddress) {
      setError(isEnsName ? 'ENS name not found' : 'Invalid address')
      return
    }
    if (effectiveApproverAddress.toLowerCase() === initiatorAddress.toLowerCase()) {
      setError('Must be different from initiator')
      return
    }
    
    // Validate optional fields
    let validUntil = 0n
    if (validUntilInput) {
      const timestamp = parseInt(validUntilInput, 10)
      if (isNaN(timestamp) || timestamp < 0) {
        setError('Invalid validUntil timestamp')
        return
      }
      validUntil = BigInt(timestamp)
    }
    
    let interfaceId: Hex = '0x00000000'
    if (interfaceIdInput) {
      if (!isHex(interfaceIdInput) || interfaceIdInput.length !== 10) {
        setError('Interface ID must be 4 bytes (e.g., 0x12345678)')
        return
      }
      interfaceId = interfaceIdInput as Hex
    }
    
    let data: Hex = '0x'
    if (dataInput) {
      if (!isHex(dataInput)) {
        setError('Data must be valid hex (e.g., 0x1234)')
        return
      }
      data = dataInput as Hex
    }
    
    setError(null)
    
    // Create the AAR
    const now = BigInt(Math.floor(Date.now() / 1000))
    const newAar: AssociatedAccountRecord = {
      initiator: addressToErc7930(initiatorAddress, baseSepolia.id),
      approver: addressToErc7930(effectiveApproverAddress, baseSepolia.id),
      validAt: now,
      validUntil,
      interfaceId,
      data,
    }
    setAar(newAar)
    setSar({
      ...sar,
      record: newAar,
    })
    setFlowStep('sign-initiator')
  }

  const handleReset = () => {
    handleDisconnect()
    setFlowStep('connect-initiator')
    setApproverInput('')
    setInitiatorAddress(null)
    setError(null)
    setShowAdvanced(false)
    setValidUntilInput('')
    setInterfaceIdInput('')
    setDataInput('')
    setAwaitingInitiatorConnect(false)
    setAwaitingApproverConnect(false)
    setStorageMethod('onchain')
    setExternalAssociationId(null)
    setIsRevokingExisting(false)
    setAar({
      initiator: '0x',
      approver: '0x',
      validAt: 0n,
      validUntil: 0n,
      interfaceId: '0x00000000',
      data: '0x',
    })
    setSar({
      revokedAt: 0n,
      initiatorKeyType: 0,
      approverKeyType: 0,
      initiatorSignature: '0x',
      approverSignature: '0x',
      record: {
        initiator: '0x',
        approver: '0x',
        validAt: 0n,
        validUntil: 0n,
        interfaceId: '0x00000000',
        data: '0x',
      },
    })
  }

  return (
    <div className="control-panel">
      
      {/* Connection Status */}
      <div className="status-section">
        <div className="status-item">
          <span className="label">Status:</span>
          <span className={`value ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        {isConnected ? (
          <>
            <div className="status-item">
              <span className="label">Address:</span>
              <span className="value address">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
            </div>
            <div className="status-item">
              <span className="label">Chain:</span>
              <span className={`value ${(isSmartWallet || chainId === baseSepolia.id) ? 'correct-chain' : isSwitchingChain ? 'switching-chain' : 'wrong-chain'}`}>
                {isSwitchingChain 
                  ? 'Switching to Base Sepolia...' 
                  : (isSmartWallet || chainId === baseSepolia.id)
                    ? 'Base Sepolia' 
                    : (chainName || `Chain ${chainId}`)}
              </span>
            </div>
            <div className="wallet-actions">
              {isWrongChain && !isSwitchingChain && (
                <button onClick={handleSwitchNetwork} className="switch-network-btn">
                  Switch to Base Sepolia
                </button>
              )}
              <button onClick={handleDisconnect} className="disconnect-btn">
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <div className="wallet-actions">
            <button onClick={() => { onWriteActivity?.(); handleConnect(); }} className="primary-btn">
              Connect Wallet
            </button>
          </div>
        )}
      </div>

      {/* Flow Steps */}
      <div className="flow-section">
        <h3>{flowStep === 'revoke-existing' ? 'Revoke Existing' : `Step ${getStepNumber(flowStep)} of 7`}</h3>
        
        {flowStep === 'connect-initiator' && (
          <div className="step-content">
            <p>Connect your Initiator wallet to get started</p>
          </div>
        )}

        {flowStep === 'input-approver' && (
          <div className="step-content">
            <p>Enter the address or ENS name of your second wallet (Approver)</p>
            <input
              type="text"
              value={approverInput}
              onChange={(e) => setApproverInput(e.target.value)}
              placeholder="0x... or vitalik.eth"
              className="address-input"
              autoComplete="off"
              data-1p-ignore
            />
            {isEnsName && (
              <div className="ens-status">
                {isResolvingEns ? (
                  <span className="resolving">Resolving ENS...</span>
                ) : resolvedAddress ? (
                  <span className="resolved">
                    → {resolvedAddress.slice(0, 6)}...{resolvedAddress.slice(-4)}
                  </span>
                ) : approverInput.length > 3 ? (
                  <span className="not-found">ENS name not found</span>
                ) : null}
              </div>
            )}
            {isSameAsInitiator && (
              <div className="same-address-error">
                Approver must be different from initiator address
              </div>
            )}
            
            {/* Advanced Options Toggle */}
            <button 
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="advanced-toggle"
            >
              {showAdvanced ? '▼' : '▶'} Advanced Options
            </button>
            
            {showAdvanced && (
              <div className="advanced-options">
                <div className="optional-field">
                  <label className="optional-label">
                    Valid Until <span className="optional-hint">(Unix timestamp, 0 = no expiry)</span>
                  </label>
                  <input
                    type="text"
                    value={validUntilInput}
                    onChange={(e) => setValidUntilInput(e.target.value)}
                    placeholder="0"
                    className="optional-input"
                    autoComplete="off"
                    data-1p-ignore
                  />
                </div>
                <div className="optional-field">
                  <label className="optional-label">
                    Interface ID <span className="optional-hint">(bytes4)</span>
                  </label>
                  <input
                    type="text"
                    value={interfaceIdInput}
                    onChange={(e) => setInterfaceIdInput(e.target.value)}
                    placeholder="0x00000000"
                    className="optional-input"
                    autoComplete="off"
                    data-1p-ignore
                  />
                </div>
                <div className="optional-field">
                  <label className="optional-label">
                    Data <span className="optional-hint">(hex bytes)</span>
                  </label>
                  <input
                    type="text"
                    value={dataInput}
                    onChange={(e) => setDataInput(e.target.value)}
                    placeholder="0x"
                    className="optional-input"
                    autoComplete="off"
                    data-1p-ignore
                  />
                </div>
              </div>
            )}
            
            <button 
              onClick={() => { onWriteActivity?.(); handleSubmitApprover(); }} 
              className="primary-btn"
              disabled={isResolvingEns || isSameAsInitiator}
            >
              {isResolvingEns ? 'Resolving...' : 'Continue'}
            </button>
          </div>
        )}

        {flowStep === 'sign-initiator' && (
          <div className="step-content">
            <p>Sign the association with your initiator wallet</p>
            <button 
              onClick={() => { onWriteActivity?.(); handleSignInitiator(); }} 
              className="primary-btn"
              disabled={isProcessing}
            >
              {isProcessing ? 'Signing...' : 'Sign Association'}
            </button>
          </div>
        )}

        {flowStep === 'connect-approver' && (
          <div className="step-content">
            <p>Connect your Approver wallet</p>
            <div className="expected-address">
              <span className="expected-label">Expected address:</span>
              <span className="expected-value">
                {effectiveApproverAddress?.slice(0, 6)}...{effectiveApproverAddress?.slice(-4)}
              </span>
              {isEnsName && <span className="ens-hint">({approverInput})</span>}
            </div>
            {isConnected ? (
              <>
                <p className="hint">Disconnect your initiator wallet first, then connect your approver wallet.</p>
                <button onClick={handleDisconnect} className="secondary-btn">
                  Disconnect Initiator
                </button>
              </>
            ) : (
              <button onClick={() => { onWriteActivity?.(); setAwaitingApproverConnect(true); handleConnect(); }} className="primary-btn">
                Connect Approver Wallet
              </button>
            )}
          </div>
        )}

        {flowStep === 'sign-approver' && (
          <div className="step-content">
            <p>Sign the association with your approver wallet</p>
            <button 
              onClick={() => { onWriteActivity?.(); handleSignApprover(); }} 
              className="primary-btn"
              disabled={isProcessing}
            >
              {isProcessing ? 'Signing...' : 'Sign Association'}
            </button>
          </div>
        )}

        {flowStep === 'store-association' && (
          <div className="step-content">
            <p>Store the association</p>
            
            {/* Storage Method Selector */}
            <div className="storage-selector">
              <label className="storage-option">
                <input
                  type="radio"
                  name="storageMethod"
                  value="onchain"
                  checked={storageMethod === 'onchain'}
                  onChange={() => setStorageMethod('onchain')}
                />
                <span className="storage-label">
                  <strong>Onchain</strong>
                  <span className="storage-hint">Base Sepolia • Gas fees apply</span>
                </span>
              </label>
              <label className="storage-option">
                <input
                  type="radio"
                  name="storageMethod"
                  value="database"
                  checked={storageMethod === 'database'}
                  onChange={() => setStorageMethod('database')}
                />
                <span className="storage-label">
                  <strong>Database</strong>
                  <span className="storage-hint">Centralized • No gas fees</span>
                </span>
              </label>
            </div>

            <button 
              onClick={() => { onWriteActivity?.(); handleStoreAssociation(); }} 
              className="primary-btn"
              disabled={isStorePending}
            >
              {storageMethod === 'onchain' 
                ? (isWritePending ? 'Confirm in Wallet...' : isConfirming ? 'Storing...' : 'Store Onchain')
                : (isStoring ? 'Storing...' : 'Store in Database')
              }
            </button>
            {storageMethod === 'onchain' && txHash && (
              <div className="tx-status">
                <a 
                  href={`https://sepolia.basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tx-link"
                >
                  View on BaseScan ↗
                </a>
              </div>
            )}
          </div>
        )}

        {flowStep === 'complete' && (
          <div className="step-content">
            <p className="success">✓ Association complete!</p>
            {associationId && (
              <div className="association-id">
                <span className="id-label">ID:</span>
                <code className="id-value">
                  {storageMethod === 'onchain' 
                    ? `${associationId.slice(0, 10)}...${associationId.slice(-8)}`
                    : associationId
                  }
                </code>
                <span className="storage-badge">{storageMethod === 'onchain' ? 'Onchain' : 'Database'}</span>
              </div>
            )}
            {sar.revokedAt === 0n ? (
              <>
                <button 
                  onClick={() => storageMethod === 'onchain' ? handleOnchainRevoke() : handleDatabaseRevoke()} 
                  className="danger-btn"
                  disabled={storageMethod === 'onchain' 
                    ? (isRevokePending || isRevokeConfirming) 
                    : isDbRevoking
                  }
                >
                  {storageMethod === 'onchain' 
                    ? (isRevokePending ? 'Confirm in Wallet...' : isRevokeConfirming ? 'Revoking...' : 'Revoke Association')
                    : (isDbRevoking ? 'Sign & Revoke...' : 'Revoke Association')
                  }
                </button>
                {storageMethod === 'onchain' && revokeTxHash && (
                  <div className="tx-status">
                    <a 
                      href={`https://sepolia.basescan.org/tx/${revokeTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tx-link"
                    >
                      View on BaseScan ↗
                    </a>
                  </div>
                )}
              </>
            ) : (
              <p className="revoked">Association has been revoked</p>
            )}
          </div>
        )}

        {flowStep === 'revoke-existing' && (
          <div className="step-content">
            <p>Revoke an existing association</p>
            
            {storageMethod === 'onchain' ? (
              <div className="revoke-info">
                <p className="warning-text">
                  Onchain revocation from the Read tab is not yet supported. 
                  Please use the normal flow to revoke onchain associations.
                </p>
                <button onClick={handleReset} className="secondary-btn">
                  Start New Flow
                </button>
              </div>
            ) : (
              <>
                <div className="revoke-info">
                  <p className="info-text">
                    You&apos;re about to revoke a database association. 
                    This will require signing a message to prove your authority.
                  </p>
                </div>
                
                {!isConnected ? (
                  <button onClick={handleConnect} className="primary-btn">
                    Connect Wallet
                  </button>
                ) : sar.revokedAt > 0n ? (
                  <p className="revoked">Association has been revoked</p>
                ) : (
                  <button 
                    onClick={() => handleDatabaseRevoke()} 
                    className="danger-btn"
                    disabled={isDbRevoking}
                  >
                    {isDbRevoking ? 'Sign & Revoke...' : 'Revoke Association'}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Reset Button */}
      {flowStep !== 'connect-initiator' && (
        <button onClick={handleReset} className="reset-btn">
          Start Over
        </button>
      )}
    </div>
  )
}

function getStepNumber(step: FlowStep): number {
  // revoke-existing is a special flow, return a distinct number
  if (step === 'revoke-existing') return 0
  
  const steps: FlowStep[] = [
    'connect-initiator',
    'input-approver', 
    'sign-initiator',
    'connect-approver',
    'sign-approver',
    'store-association',
    'complete'
  ]
  return steps.indexOf(step) + 1
}
