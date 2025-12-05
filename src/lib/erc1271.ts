import { type Address, type Hex, hashTypedData, getAddress } from 'viem'
import { EIP712_DOMAIN, ASSOCIATED_ACCOUNT_RECORD_TYPES } from './eip712'
import type { AssociatedAccountRecord } from './types'

// ERC-1271 magic value returned for valid signatures
export const ERC1271_MAGIC_VALUE = '0x1626ba7e' as const

/**
 * Minimal client interface for ERC-1271/6492 signature validation.
 * This is compatible with both viem's PublicClient and wagmi's usePublicClient return type.
 */
export interface Erc1271Client {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readContract: (args: any) => Promise<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  call: (args: any) => Promise<any>
  getCode: (args: { address: Address }) => Promise<Hex | undefined>
}

// ERC-1271 ABI for isValidSignature
export const erc1271Abi = [
  {
    type: 'function',
    name: 'isValidSignature',
    inputs: [
      { name: 'hash', type: 'bytes32', internalType: 'bytes32' },
      { name: 'signature', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [{ name: 'magicValue', type: 'bytes4', internalType: 'bytes4' }],
    stateMutability: 'view',
  },
] as const

/**
 * Check if an address is a smart contract by checking if it has code.
 * Returns true if the address has deployed bytecode.
 */
export async function isSmartContract(
  client: Erc1271Client,
  address: Address
): Promise<boolean> {
  const bytecode = await client.getCode({ address })
  return bytecode !== undefined && bytecode !== '0x' && bytecode.length > 2
}

/**
 * Validate a signature using ERC-1271's isValidSignature.
 * Used for smart contract wallets that implement the ERC-1271 interface.
 */
export async function verifyErc1271Signature(
  client: Erc1271Client,
  contractAddress: Address,
  aar: AssociatedAccountRecord,
  signature: Hex
): Promise<boolean> {
  // Compute the EIP-712 hash of the AAR
  const hash = hashTypedData({
    domain: EIP712_DOMAIN,
    types: ASSOCIATED_ACCOUNT_RECORD_TYPES,
    primaryType: 'AssociatedAccountRecord',
    message: {
      initiator: aar.initiator,
      approver: aar.approver,
      validAt: Number(aar.validAt),
      validUntil: Number(aar.validUntil),
      interfaceId: aar.interfaceId,
      data: aar.data,
    },
  })

  try {
    const result = await client.readContract({
      address: getAddress(contractAddress),
      abi: erc1271Abi,
      functionName: 'isValidSignature',
      args: [hash, signature],
    })

    return result === ERC1271_MAGIC_VALUE
  } catch {
    // Contract call failed - signature is invalid or contract doesn't implement ERC-1271
    return false
  }
}
