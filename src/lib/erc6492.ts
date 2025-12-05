import { type Address, type Hex, hashTypedData, getAddress, decodeAbiParameters, encodeAbiParameters } from 'viem'
import { EIP712_DOMAIN, ASSOCIATED_ACCOUNT_RECORD_TYPES } from './eip712'
import type { AssociatedAccountRecord } from './types'
import { type Erc1271Client, isSmartContract, verifyErc1271Signature } from './erc1271'

// ERC-6492 magic suffix that identifies wrapped signatures for undeployed contracts
export const ERC6492_MAGIC_SUFFIX = '0x6492649264926492649264926492649264926492649264926492649264926492' as const

// Universal Signature Validator - deployed at deterministic address via CREATE2
// See: https://eips.ethereum.org/EIPS/eip-6492
export const UNIVERSAL_SIG_VALIDATOR = '0x6DdA9f3BB8FFCe9bc0245a8e2D5C56bA4cC89D26' as const

// Universal Signature Validator ABI
export const universalSigValidatorAbi = [
  {
    type: 'function',
    name: 'isValidSig',
    inputs: [
      { name: '_signer', type: 'address', internalType: 'address' },
      { name: '_hash', type: 'bytes32', internalType: 'bytes32' },
      { name: '_signature', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const

/**
 * Check if a signature is ERC-6492 wrapped (for undeployed contracts).
 * ERC-6492 signatures end with a specific 32-byte magic suffix.
 */
export function isErc6492Signature(signature: Hex): boolean {
  if (signature.length < 66) return false // Minimum: 0x + 32 bytes suffix
  const suffix = signature.slice(-64) // Last 32 bytes (64 hex chars)
  return `0x${suffix}`.toLowerCase() === ERC6492_MAGIC_SUFFIX.toLowerCase()
}

/**
 * Unwrap an ERC-6492 signature to get the components.
 * Returns null if the signature is not ERC-6492 wrapped.
 */
export function unwrapErc6492Signature(signature: Hex): {
  factory: Address
  factoryCalldata: Hex
  originalSignature: Hex
} | null {
  if (!isErc6492Signature(signature)) return null

  // Remove the magic suffix (32 bytes = 64 hex chars)
  const wrappedData = `0x${signature.slice(2, -64)}` as Hex

  try {
    const [factory, factoryCalldata, originalSignature] = decodeAbiParameters(
      [
        { name: 'factory', type: 'address' },
        { name: 'factoryCalldata', type: 'bytes' },
        { name: 'originalSignature', type: 'bytes' },
      ],
      wrappedData
    )
    return {
      factory: factory as Address,
      factoryCalldata: factoryCalldata as Hex,
      originalSignature: originalSignature as Hex,
    }
  } catch {
    return null
  }
}

/**
 * Wrap a signature in ERC-6492 format for undeployed contracts.
 */
export function wrapErc6492Signature(
  factory: Address,
  factoryCalldata: Hex,
  originalSignature: Hex
): Hex {
  const encoded = encodeAbiParameters(
    [
      { name: 'factory', type: 'address' },
      { name: 'factoryCalldata', type: 'bytes' },
      { name: 'originalSignature', type: 'bytes' },
    ],
    [factory, factoryCalldata, originalSignature]
  )
  // Append magic suffix (without 0x prefix since encoded already has 0x)
  return `${encoded}${ERC6492_MAGIC_SUFFIX.slice(2)}` as Hex
}

/**
 * Validate an ERC-6492 signature for undeployed smart contract wallets.
 * Uses the Universal Signature Validator to simulate deployment and validate.
 * 
 * This works by:
 * 1. Simulating the factory call to deploy the contract
 * 2. Then calling isValidSignature on the deployed contract
 * 
 * Falls back to regular ERC-1271 validation if contract is already deployed.
 */
export async function verifyErc6492Signature(
  client: Erc1271Client,
  signerAddress: Address,
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

  // Check if contract is already deployed
  const isDeployed = await isSmartContract(client, signerAddress)

  if (isDeployed && !isErc6492Signature(signature)) {
    // Contract is deployed and signature is not wrapped - use regular ERC-1271
    return verifyErc1271Signature(client, signerAddress, aar, signature)
  }

  // Use Universal Signature Validator for ERC-6492 validation
  // This handles both wrapped signatures and already-deployed contracts
  try {
    // Encode the call to isValidSig
    const calldata = encodeAbiParameters(
      [
        { name: '_signer', type: 'address' },
        { name: '_hash', type: 'bytes32' },
        { name: '_signature', type: 'bytes' },
      ],
      [getAddress(signerAddress), hash, signature]
    )

    // The Universal Signature Validator function selector for isValidSig
    const functionSelector = '0x6ccea652' // isValidSig(address,bytes32,bytes)
    const fullCalldata = `${functionSelector}${calldata.slice(2)}` as Hex

    // Use eth_call to simulate the validation
    // Note: We use call instead of readContract because isValidSig is nonpayable
    // and we want to simulate state changes (contract deployment) without committing
    const result = await client.call({
      to: UNIVERSAL_SIG_VALIDATOR,
      data: fullCalldata,
    })

    // Result should be bool (true = valid)
    if (result?.data) {
      // Decode bool from return data
      const [isValid] = decodeAbiParameters([{ type: 'bool' }], result.data)
      return isValid as boolean
    }
    return false
  } catch {
    // If Universal Validator isn't deployed or call fails, try unwrapping manually
    if (isErc6492Signature(signature)) {
      const unwrapped = unwrapErc6492Signature(signature)
      if (unwrapped && isDeployed) {
        // Contract is now deployed, try with original signature
        return verifyErc1271Signature(client, signerAddress, aar, unwrapped.originalSignature)
      }
    }
    return false
  }
}

