import { type Address, type Hex, toHex } from 'viem'
import { buildFromPayload } from '@wonderland/interop-addresses'

// Key type constants from ERC-8092
export const KEY_TYPES = {
  DELEGATED: 0x0000,
  K1: 0x0001,       // secp256k1
  R1: 0x0002,       // secp256r1
  BLS: 0x0003,      // BLS12-381
  EdDSA: 0x0004,    // Ed25519
  WEBAUTHN: 0x8001,
  ERC1271: 0x8002,
  ERC6492: 0x8003,
} as const

export type KeyType = (typeof KEY_TYPES)[keyof typeof KEY_TYPES]

// Associated Account Record - the core association data
export interface AssociatedAccountRecord {
  initiator: Hex        // ERC-7930 binary representation
  approver: Hex         // ERC-7930 binary representation  
  validAt: bigint       // uint40 timestamp
  validUntil: bigint    // uint40 timestamp (0 = no expiry)
  interfaceId: Hex      // bytes4 selector
  data: Hex             // arbitrary data
}

// Signed Association Record - wraps AAR with signatures
export interface SignedAssociationRecord {
  revokedAt: bigint            // uint40 timestamp (0 = not revoked)
  initiatorKeyType: number     // bytes2 key type
  approverKeyType: number      // bytes2 key type
  initiatorSignature: Hex      // signature bytes
  approverSignature: Hex       // signature bytes
  record: AssociatedAccountRecord
}

// Demo flow state
export type FlowStep = 
  | 'connect-initiator'
  | 'input-approver'
  | 'sign-initiator'
  | 'connect-approver'
  | 'sign-approver'
  | 'store-association'
  | 'complete'
  | 'revoke-existing'

// Helper to convert address to ERC-7930 format using interop-addresses library
export function addressToErc7930(address: Address, chainId: number): Hex {
  return buildFromPayload({
    version: 1,
    chainType: 'eip155',
    chainReference: toHex(chainId),
    address: address,
  })
}

// Create empty AAR
export function createEmptyAAR(): AssociatedAccountRecord {
  return {
    initiator: '0x',
    approver: '0x',
    validAt: 0n,
    validUntil: 0n,
    interfaceId: '0x00000000',
    data: '0x',
  }
}

// Create empty SAR
export function createEmptySAR(): SignedAssociationRecord {
  return {
    revokedAt: 0n,
    initiatorKeyType: 0,
    approverKeyType: 0,
    initiatorSignature: '0x',
    approverSignature: '0x',
    record: createEmptyAAR(),
  }
}

