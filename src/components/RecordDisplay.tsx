'use client'

import { useState } from 'react'
import type { AssociatedAccountRecord, SignedAssociationRecord } from '@/lib/types'
import { aarToJson, sarToJson, copyToClipboard } from '@/lib/serialize'

interface RecordDisplayProps {
  aar: AssociatedAccountRecord
  sar: SignedAssociationRecord
}

export function RecordDisplay({ aar, sar }: RecordDisplayProps) {
  const [copiedStruct, setCopiedStruct] = useState<'aar' | 'sar' | null>(null)

  const isAarActive = aar.initiator !== '0x'
  const isSarActive = sar.initiatorSignature !== '0x' || sar.approverSignature !== '0x'

  const handleCopyAAR = async () => {
    if (!isAarActive) return
    const json = JSON.stringify(aarToJson(aar), null, 2)
    const success = await copyToClipboard(json)
    if (success) {
      setCopiedStruct('aar')
      setTimeout(() => setCopiedStruct(null), 2000)
    }
  }

  const handleCopySAR = async () => {
    if (!isSarActive) return
    const json = JSON.stringify(sarToJson(sar), null, 2)
    const success = await copyToClipboard(json)
    if (success) {
      setCopiedStruct('sar')
      setTimeout(() => setCopiedStruct(null), 2000)
    }
  }

  return (
    <div className="record-display">
      {/* Associated Account Record */}
      <div className="record-section">
        <div className="record-header">
          <h2>AssociatedAccountRecord</h2>
          <button 
            className={`struct-copy-btn ${isAarActive ? 'active' : ''} ${copiedStruct === 'aar' ? 'copied' : ''}`}
            onClick={handleCopyAAR}
            disabled={!isAarActive}
            title="Copy as JSON"
          >
            {copiedStruct === 'aar' ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>
        <div className="record-card">
          <RecordField 
            label="initiator" 
            value={aar.initiator} 
            type="bytes"
            isEmpty={aar.initiator === '0x'}
          />
          <RecordField 
            label="approver" 
            value={aar.approver} 
            type="bytes"
            isEmpty={aar.approver === '0x'}
          />
          <RecordField 
            label="validAt" 
            value={aar.validAt.toString()} 
            type="uint40"
            isEmpty={aar.validAt === 0n}
            timestamp={aar.validAt}
          />
          <RecordField 
            label="validUntil" 
            value={aar.validUntil.toString()} 
            type="uint40"
            isEmpty={aar.validUntil === 0n}
            timestamp={aar.validUntil}
            isOptional
          />
          <RecordField 
            label="interfaceId" 
            value={aar.interfaceId} 
            type="bytes4"
            isEmpty={aar.interfaceId === '0x00000000'}
            isOptional
          />
          <RecordField 
            label="data" 
            value={aar.data} 
            type="bytes"
            isEmpty={aar.data === '0x'}
            isOptional
          />
        </div>
      </div>

      {/* Signed Association Record */}
      <div className="record-section">
        <div className="record-header">
          <h2>SignedAssociationRecord</h2>
          <button 
            className={`struct-copy-btn ${isSarActive ? 'active' : ''} ${copiedStruct === 'sar' ? 'copied' : ''}`}
            onClick={handleCopySAR}
            disabled={!isSarActive}
            title="Copy as JSON"
          >
            {copiedStruct === 'sar' ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>
        <div className="record-card">
          <RecordField 
            label="revokedAt" 
            value={sar.revokedAt.toString()} 
            type="uint40"
            isEmpty={sar.revokedAt === 0n}
            timestamp={sar.revokedAt}
            isRevoked={sar.revokedAt > 0n}
          />
          <RecordField 
            label="initiatorKeyType" 
            value={`0x${sar.initiatorKeyType.toString(16).padStart(4, '0')}`} 
            type="bytes2"
            keyType={sar.initiatorKeyType}
          />
          <RecordField 
            label="approverKeyType" 
            value={`0x${sar.approverKeyType.toString(16).padStart(4, '0')}`} 
            type="bytes2"
            keyType={sar.approverKeyType}
          />
          <RecordField 
            label="initiatorSignature" 
            value={sar.initiatorSignature} 
            type="bytes"
            isEmpty={sar.initiatorSignature === '0x'}
            isSignature
          />
          <RecordField 
            label="approverSignature" 
            value={sar.approverSignature} 
            type="bytes"
            isEmpty={sar.approverSignature === '0x'}
            isSignature
          />
          <div className="nested-record">
            <span className="field-label">record:</span>
            <span className="field-type">AssociatedAccountRecord</span>
            <span className="nested-indicator">↑ See above</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface RecordFieldProps {
  label: string
  value: string
  type: string
  isEmpty?: boolean
  isOptional?: boolean
  timestamp?: bigint
  isSignature?: boolean
  keyType?: number
  isRevoked?: boolean
}

function RecordField({ 
  label, 
  value, 
  type, 
  isEmpty, 
  isOptional,
  timestamp,
  isSignature,
  keyType,
  isRevoked
}: RecordFieldProps) {
  const [copied, setCopied] = useState(false)

  const getKeyTypeName = (kt: number): string => {
    const names: Record<number, string> = {
      0x0000: 'Delegated',
      0x0001: 'K1 (secp256k1)',
      0x0002: 'R1 (secp256r1)',
      0x0003: 'BLS (BLS12-381)',
      0x0004: 'EdDSA (Ed25519)',
      0x8001: 'WebAuthn',
      0x8002: 'ERC-1271',
      0x8003: 'ERC-6492',
    }
    return names[kt] || 'Unknown'
  }

  const formatTimestamp = (ts: bigint): string => {
    if (ts === 0n) return ''
    const date = new Date(Number(ts) * 1000)
    return date.toLocaleString()
  }

  const truncateValue = (v: string): string => {
    if (v.length <= 20) return v
    return `${v.slice(0, 10)}...${v.slice(-8)}`
  }

  const handleCopy = async () => {
    if (isEmpty) return
    const success = await copyToClipboard(value)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className={`record-field ${isEmpty ? 'empty' : 'filled'} ${isRevoked ? 'revoked' : ''}`}>
      <div className="field-header">
        <span className="field-label">{label}:</span>
        <span className="field-type">{type}</span>
        {isOptional && <span className="optional-tag">optional</span>}
        {!isEmpty && (
          <button 
            className={`field-copy-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            title="Copy value"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        )}
      </div>
      <div className="field-value">
        {isEmpty ? (
          <span className="empty-value">—</span>
        ) : isSignature ? (
          <span className="signature-value" title={value}>
            {truncateValue(value)}
            <span className="signature-check">✓</span>
          </span>
        ) : (
          <span className="hex-value" title={value}>{truncateValue(value)}</span>
        )}
        {keyType !== undefined && (
          <span className="key-type-name">{getKeyTypeName(keyType)}</span>
        )}
        {timestamp && timestamp > 0n && (
          <span className="timestamp-display">{formatTimestamp(timestamp)}</span>
        )}
      </div>
    </div>
  )
}

// Simple copy icon
function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  )
}

// Simple check icon
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  )
}
