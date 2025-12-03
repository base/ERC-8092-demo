import { type Hex, verifyTypedData } from 'viem'
import { EIP712_DOMAIN, ASSOCIATED_ACCOUNT_RECORD_TYPES } from './eip712'
import type { AssociatedAccountRecord, SignedAssociationRecord } from './types'

/**
 * ERC-8092 Validation
 * 
 * Per the spec, clients or contracts determining whether a SignedAssociationRecord
 * is valid at the time of consumption MUST check all of the following validation steps.
 */

export interface ValidationInput {
  aar: AssociatedAccountRecord
  sar: SignedAssociationRecord
  /** Extracted EVM address of the initiator (from ERC-7930 bytes) */
  initiatorAddress: Hex
  /** Extracted EVM address of the approver (from ERC-7930 bytes) */
  approverAddress: Hex
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate a SignedAssociationRecord according to ERC-8092.
 * 
 * Validation steps:
 * 1. The current timestamp MUST be greater than or equal to the `validAt` timestamp.
 * 2. If the `validUntil` timestamp is nonzero, the current timestamp MUST be less than the `validUntil` timestamp.
 * 3. If the `revokedAt` timestamp is nonzero, the current timestamp MUST be less than the `revokedAt` timestamp.
 * 4. If the `initiatorSignature` field is populated, the signature MUST be valid for the EIP-712 
 *    preimage of the underlying `AssociatedAccountRecord`.
 * 5. If the `approverSignature` field is populated, the signature MUST be valid for the EIP-712 
 *    preimage of the underlying `AssociatedAccountRecord`.
 */
export async function validateAssociation(input: ValidationInput): Promise<ValidationResult> {
  const { aar, sar, initiatorAddress, approverAddress } = input
  const now = BigInt(Math.floor(Date.now() / 1000))

  // 1. Current timestamp MUST be >= validAt
  if (now < aar.validAt) {
    return {
      valid: false,
      error: `Association not yet valid (validAt: ${aar.validAt}, now: ${now})`,
    }
  }

  // 2. If validUntil is nonzero, current timestamp MUST be < validUntil
  if (aar.validUntil !== 0n && now >= aar.validUntil) {
    return {
      valid: false,
      error: `Association has expired (validUntil: ${aar.validUntil}, now: ${now})`,
    }
  }

  // 3. If revokedAt is nonzero, current timestamp MUST be < revokedAt
  if (sar.revokedAt !== 0n && now >= sar.revokedAt) {
    return {
      valid: false,
      error: `Association is revoked (revokedAt: ${sar.revokedAt}, now: ${now})`,
    }
  }

  // Build the EIP-712 message for signature verification
  // Note: EIP-712 signing uses Number for uint40 fields
  const eip712Message = {
    initiator: aar.initiator,
    approver: aar.approver,
    validAt: Number(aar.validAt),
    validUntil: Number(aar.validUntil),
    interfaceId: aar.interfaceId,
    data: aar.data,
  }

  // 4. Validate initiator signature (if populated)
  if (sar.initiatorSignature && sar.initiatorSignature !== '0x') {
    const isInitiatorValid = await verifyTypedData({
      address: initiatorAddress,
      domain: EIP712_DOMAIN,
      types: ASSOCIATED_ACCOUNT_RECORD_TYPES,
      primaryType: 'AssociatedAccountRecord',
      message: eip712Message,
      signature: sar.initiatorSignature,
    })

    if (!isInitiatorValid) {
      return {
        valid: false,
        error: 'Invalid initiator signature',
      }
    }
  }

  // 5. Validate approver signature (if populated)
  if (sar.approverSignature && sar.approverSignature !== '0x') {
    const isApproverValid = await verifyTypedData({
      address: approverAddress,
      domain: EIP712_DOMAIN,
      types: ASSOCIATED_ACCOUNT_RECORD_TYPES,
      primaryType: 'AssociatedAccountRecord',
      message: eip712Message,
      signature: sar.approverSignature,
    })

    if (!isApproverValid) {
      return {
        valid: false,
        error: 'Invalid approver signature',
      }
    }
  }

  return { valid: true }
}

