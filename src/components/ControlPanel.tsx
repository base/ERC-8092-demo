'use client'

import { useState, useEffect } from 'react'
import { type Address, type Hex, isAddress, isHex } from 'viem'
import { useEnsAddress } from 'wagmi'
import { baseSepolia, mainnet } from 'wagmi/chains'
import type { FlowStep, AssociatedAccountRecord, SignedAssociationRecord } from '@/lib/types'
import { addressToErc7930 } from '@/lib/types'
import { useWalletConnection, useAssociationSigning, useAssociationStorage, useAssociationRevocation } from '@/hooks'

interface ControlPanelProps {
  flowStep: FlowStep
  setFlowStep: (step: FlowStep) => void
  aar: AssociatedAccountRecord
  setAar: (aar: AssociatedAccountRecord) => void
  sar: SignedAssociationRecord
  setSar: (sar: SignedAssociationRecord) => void
}

export function ControlPanel({ 
  flowStep, 
  setFlowStep, 
  aar, 
  setAar, 
  sar, 
  setSar 
}: ControlPanelProps) {
  // Local state
  const [approverInput, setApproverInput] = useState('')
  const [initiatorAddress, setInitiatorAddress] = useState<Address | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [awaitingInitiatorConnect, setAwaitingInitiatorConnect] = useState(true)
  const [awaitingApproverConnect, setAwaitingApproverConnect] = useState(false)
  
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

  const {
    txHash,
    isWritePending,
    isConfirming,
    associationId,
    handleStoreAssociation,
  } = useAssociationStorage({
    aar,
    sar,
    flowStep,
    setFlowStep,
    setError,
  })

  const {
    revokeTxHash,
    isRevokePending,
    isRevokeConfirming,
    handleRevoke,
  } = useAssociationRevocation({
    associationId,
    sar,
    setSar,
    setError,
  })

  // ENS resolution
  const isEnsName = approverInput.includes('.') && !approverInput.startsWith('0x')
  const { data: resolvedAddress, isLoading: isResolvingEns } = useEnsAddress({
    name: isEnsName ? approverInput : undefined,
    chainId: mainnet.id,
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
      <h2>Controls</h2>
      
      {/* Connection Status */}
      <div className="status-section">
        <div className="status-item">
          <span className="label">Status:</span>
          <span className={`value ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        {isConnected && (
          <>
            <div className="status-item">
              <span className="label">Address:</span>
              <span className="value address">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
            </div>
            <div className="status-item">
              <span className="label">Chain:</span>
              <span className={`value ${chainId === baseSepolia.id ? 'correct-chain' : 'wrong-chain'}`}>
                {chainId === baseSepolia.id ? 'Base Sepolia' : (chainName || `Chain ${chainId}`)}
              </span>
            </div>
            <div className="wallet-actions">
              {isWrongChain && (
                <button onClick={handleSwitchNetwork} className="switch-network-btn">
                  Switch to Base Sepolia
                </button>
              )}
              <button onClick={handleDisconnect} className="disconnect-btn">
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>

      {/* Flow Steps */}
      <div className="flow-section">
        <h3>Step {getStepNumber(flowStep)} of 7</h3>
        
        {flowStep === 'connect-initiator' && (
          <div className="step-content">
            <p>Connect your Initiator wallet</p>
            <button onClick={handleConnect} className="primary-btn">
              Connect Wallet
            </button>
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
              onClick={handleSubmitApprover} 
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
              onClick={handleSignInitiator} 
              className="primary-btn"
              disabled={isProcessing}
            >
              {isProcessing ? 'Signing...' : 'Sign Association'}
            </button>
          </div>
        )}

        {flowStep === 'connect-approver' && (
          <div className="step-content">
            <p>Switch to your second wallet using your wallet extension</p>
            <div className="expected-address">
              <span className="expected-label">Expected address:</span>
              <span className="expected-value">
                {effectiveApproverAddress?.slice(0, 6)}...{effectiveApproverAddress?.slice(-4)}
              </span>
              {isEnsName && <span className="ens-hint">({approverInput})</span>}
            </div>
            <p className="hint">Waiting for wallet change...</p>
          </div>
        )}

        {flowStep === 'sign-approver' && (
          <div className="step-content">
            <p>Sign the association with your approver wallet</p>
            <button 
              onClick={handleSignApprover} 
              className="primary-btn"
              disabled={isProcessing}
            >
              {isProcessing ? 'Signing...' : 'Sign Association'}
            </button>
          </div>
        )}

        {flowStep === 'store-association' && (
          <div className="step-content">
            <p>Store the association onchain</p>
            <button 
              onClick={handleStoreAssociation} 
              className="primary-btn"
              disabled={isWritePending || isConfirming}
            >
              {isWritePending ? 'Confirm in Wallet...' : isConfirming ? 'Storing...' : 'Store Association'}
            </button>
            {txHash && (
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
            {sar.revokedAt === 0n ? (
              <>
                <button 
                  onClick={() => handleRevoke()} 
                  className="danger-btn"
                  disabled={isRevokePending || isRevokeConfirming}
                >
                  {isRevokePending ? 'Confirm in Wallet...' : isRevokeConfirming ? 'Revoking...' : 'Revoke Association'}
                </button>
                {revokeTxHash && (
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
