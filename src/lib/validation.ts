import { type Hex, verifyTypedData, getAddress } from 'viem'
import { EIP712_DOMAIN, ASSOCIATED_ACCOUNT_RECORD_TYPES } from './eip712'
import type { AssociatedAccountRecord, SignedAssociationRecord } from './types'
import { KEY_TYPES } from './types'
import { verifyErc1271Signature, type Erc1271Client } from './erc1271'
import { verifyErc6492Signature } from './erc6492'

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
  /** Public client for ERC-1271/6492 validation (required for smart contract wallets) */
  publicClient?: Erc1271Client
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
 * 
 * Supported signature types:
 * - K1 (secp256k1): Standard EOA signatures
 * - ERC-1271: Smart contract wallet signatures (deployed contracts)
 * - ERC-6492: Smart contract wallet signatures (undeployed/counterfactual contracts)
 */
export async function validateAssociation(input: ValidationInput): Promise<ValidationResult> {
  const { aar, sar, initiatorAddress, approverAddress, publicClient } = input
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
    const isInitiatorValid = await verifySignature({
      address: initiatorAddress,
      signature: sar.initiatorSignature,
      keyType: sar.initiatorKeyType,
      aar,
      eip712Message,
      publicClient,
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
    const isApproverValid = await verifySignature({
      address: approverAddress,
      signature: sar.approverSignature,
      keyType: sar.approverKeyType,
      aar,
      eip712Message,
      publicClient,
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

interface VerifySignatureParams {
  address: Hex
  signature: Hex
  keyType: number
  aar: AssociatedAccountRecord
  eip712Message: {
    initiator: Hex
    approver: Hex
    validAt: number
    validUntil: number
    interfaceId: Hex
    data: Hex
  }
  publicClient?: Erc1271Client
}

/**
 * Verify a signature based on its key type.
 * Supports:
 * - EOA (K1/secp256k1) signatures
 * - Smart contract (ERC-1271) signatures for deployed contracts
 * - Counterfactual (ERC-6492) signatures for undeployed smart contract wallets
 */
async function verifySignature(params: VerifySignatureParams): Promise<boolean> {
  const { address, signature, keyType, aar, eip712Message, publicClient } = params

  // ERC-6492: Counterfactual smart contract wallet signature (undeployed)
  if (keyType === KEY_TYPES.ERC6492) {
    if (!publicClient) {
      // Cannot validate ERC-6492 signature without a public client
      return false
    }

    return verifyErc6492Signature(
      publicClient,
      getAddress(address),
      aar,
      signature
    )
  }

  // ERC-1271: Smart contract wallet signature (deployed)
  if (keyType === KEY_TYPES.ERC1271) {
    if (!publicClient) {
      // Cannot validate ERC-1271 signature without a public client
      return false
    }

    return verifyErc1271Signature(
      publicClient,
      getAddress(address),
      aar,
      signature
    )
  }

  // K1 (secp256k1): Standard EOA signature
  // Also handle DELEGATED (0x0000) as EOA for backwards compatibility
  if (keyType === KEY_TYPES.K1 || keyType === KEY_TYPES.DELEGATED) {
    return verifyTypedData({
      address: getAddress(address),
      domain: EIP712_DOMAIN,
      types: ASSOCIATED_ACCOUNT_RECORD_TYPES,
      primaryType: 'AssociatedAccountRecord',
      message: eip712Message,
      signature,
    })
  }

  // Unsupported key type
  return false
}
