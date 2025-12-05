import type { AssociatedAccountRecord } from './types'

// EIP-712 Domain for Associated Accounts (from ERC-8092 spec)
export const EIP712_DOMAIN = {
  name: 'AssociatedAccounts',
  version: '1',
} as const

// EIP-712 Types for AssociatedAccountRecord
export const ASSOCIATED_ACCOUNT_RECORD_TYPES = {
  AssociatedAccountRecord: [
    { name: 'initiator', type: 'bytes' },
    { name: 'approver', type: 'bytes' },
    { name: 'validAt', type: 'uint40' },
    { name: 'validUntil', type: 'uint40' },
    { name: 'interfaceId', type: 'bytes4' },
    { name: 'data', type: 'bytes' },
  ],
} as const

// Convert AAR to EIP-712 message format
export function aarToEip712Message(aar: AssociatedAccountRecord) {
  return {
    initiator: aar.initiator,
    approver: aar.approver,
    validAt: aar.validAt,
    validUntil: aar.validUntil,
    interfaceId: aar.interfaceId,
    data: aar.data,
  }
}

// Get typed data for signing
export function getTypedDataForAAR(aar: AssociatedAccountRecord) {
  return {
    domain: EIP712_DOMAIN,
    types: ASSOCIATED_ACCOUNT_RECORD_TYPES,
    primaryType: 'AssociatedAccountRecord' as const,
    message: aarToEip712Message(aar),
  }
}

