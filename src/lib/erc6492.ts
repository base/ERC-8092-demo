import { type Hex } from 'viem'

// ERC-6492 magic suffix that identifies wrapped signatures for undeployed contracts
// See: https://eips.ethereum.org/EIPS/eip-6492
export const ERC6492_MAGIC_SUFFIX = '0x6492649264926492649264926492649264926492649264926492649264926492' as const

/**
 * Check if a signature is ERC-6492 wrapped (for undeployed contracts).
 * ERC-6492 signatures end with a specific 32-byte magic suffix.
 * 
 * Used to detect the key type when a smart wallet signs before deployment.
 */
export function isErc6492Signature(signature: Hex): boolean {
  if (signature.length < 66) return false // Minimum: 0x + 32 bytes suffix
  const suffix = signature.slice(-64) // Last 32 bytes (64 hex chars)
  return `0x${suffix}`.toLowerCase() === ERC6492_MAGIC_SUFFIX.toLowerCase()
}
