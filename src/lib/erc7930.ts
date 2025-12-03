import { type Hex } from 'viem'

/**
 * Extract the EVM address from ERC-7930 binary representation.
 * ERC-7930 format ends with the 20-byte address for EVM chains.
 */
export function extractAddress(erc7930Bytes: Hex): string {
  // Remove 0x prefix, get last 40 chars (20 bytes = address)
  const hex = erc7930Bytes.slice(2)
  if (hex.length >= 40) {
    const address = '0x' + hex.slice(-40)
    return address.toLowerCase()
  }
  // Fallback: assume it's already a raw address
  return erc7930Bytes.toLowerCase()
}

