import type { AssociatedAccountRecord, SignedAssociationRecord } from './types'

// Convert AAR to JSON-serializable format
export function aarToJson(aar: AssociatedAccountRecord): object {
  return {
    initiator: aar.initiator,
    approver: aar.approver,
    validAt: aar.validAt.toString(),
    validUntil: aar.validUntil.toString(),
    interfaceId: aar.interfaceId,
    data: aar.data,
  }
}

// Convert SAR to JSON-serializable format
export function sarToJson(sar: SignedAssociationRecord): object {
  return {
    revokedAt: sar.revokedAt.toString(),
    initiatorKeyType: `0x${sar.initiatorKeyType.toString(16).padStart(4, '0')}`,
    approverKeyType: `0x${sar.approverKeyType.toString(16).padStart(4, '0')}`,
    initiatorSignature: sar.initiatorSignature,
    approverSignature: sar.approverSignature,
    record: aarToJson(sar.record),
  }
}

// Copy text to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

