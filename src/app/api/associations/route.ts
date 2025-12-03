import { NextResponse } from 'next/server'
import { sql, type DbAssociation } from '@/lib/db'
import { extractAddress } from '@/lib/erc7930'
import { validateAssociation } from '@/lib/validation'
import { type Hex, verifyMessage } from 'viem'

// Request body type for POST
interface StoreAssociationRequest {
  aar: {
    initiator: Hex
    approver: Hex
    validAt: string
    validUntil: string
    interfaceId: Hex
    data: Hex
  }
  sar: {
    revokedAt: string
    initiatorKeyType: number
    approverKeyType: number
    initiatorSignature: Hex
    approverSignature: Hex
  }
}

// Helper to format key type as 6-char string (e.g., "0x0001")
function formatKeyType(keyType: number): string {
  return `0x${keyType.toString(16).padStart(4, '0')}`
}

export async function POST(request: Request) {
  try {
    const body: StoreAssociationRequest = await request.json()
    const { aar, sar } = body

    // Extract addresses from ERC-7930 format
    const initiatorAddress = extractAddress(aar.initiator)
    const approverAddress = extractAddress(aar.approver)

    // ERC-8092 Validation
    const validationResult = await validateAssociation({
      aar: {
        initiator: aar.initiator,
        approver: aar.approver,
        validAt: BigInt(aar.validAt),
        validUntil: BigInt(aar.validUntil),
        interfaceId: aar.interfaceId,
        data: aar.data,
      },
      sar: {
        revokedAt: BigInt(sar.revokedAt),
        initiatorKeyType: sar.initiatorKeyType,
        approverKeyType: sar.approverKeyType,
        initiatorSignature: sar.initiatorSignature,
        approverSignature: sar.approverSignature,
        record: {
          initiator: aar.initiator,
          approver: aar.approver,
          validAt: BigInt(aar.validAt),
          validUntil: BigInt(aar.validUntil),
          interfaceId: aar.interfaceId,
          data: aar.data,
        },
      },
      initiatorAddress: initiatorAddress as Hex,
      approverAddress: approverAddress as Hex,
    })

    if (!validationResult.valid) {
      return NextResponse.json(
        { success: false, error: validationResult.error },
        { status: 400 }
      )
    }

    // Ensure accounts exist (upsert)
    await sql`
      INSERT INTO accounts (address) 
      VALUES (${initiatorAddress})
      ON CONFLICT (address) DO NOTHING
    `
    await sql`
      INSERT INTO accounts (address) 
      VALUES (${approverAddress})
      ON CONFLICT (address) DO NOTHING
    `

    // Insert the association
    const result = await sql`
      INSERT INTO associations (
        initiator_address,
        approver_address,
        initiator_bytes,
        approver_bytes,
        valid_at,
        valid_until,
        interface_id,
        data,
        revoked_at,
        initiator_key_type,
        approver_key_type,
        initiator_signature,
        approver_signature
      ) VALUES (
        ${initiatorAddress},
        ${approverAddress},
        ${aar.initiator},
        ${aar.approver},
        ${BigInt(aar.validAt)},
        ${aar.validUntil === '0' ? null : BigInt(aar.validUntil)},
        ${aar.interfaceId === '0x00000000' ? null : aar.interfaceId},
        ${aar.data === '0x' ? null : aar.data},
        ${sar.revokedAt === '0' ? null : BigInt(sar.revokedAt)},
        ${formatKeyType(sar.initiatorKeyType)},
        ${formatKeyType(sar.approverKeyType)},
        ${sar.initiatorSignature},
        ${sar.approverSignature}
      )
      RETURNING id
    `

    const associationId = result[0]?.id

    return NextResponse.json({
      success: true,
      associationId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')?.toLowerCase()
    const id = searchParams.get('id')

    let associations: DbAssociation[]

    if (id) {
      // Get specific association by ID
      associations = await sql`
        SELECT * FROM associations WHERE id = ${parseInt(id, 10)}
      ` as DbAssociation[]
    } else if (address) {
      // Get all associations for an address (as initiator or approver)
      associations = await sql`
        SELECT * FROM associations 
        WHERE initiator_address = ${address} OR approver_address = ${address}
        ORDER BY created_at DESC
      ` as DbAssociation[]
    } else {
      // Get all associations (with limit)
      associations = await sql`
        SELECT * FROM associations 
        ORDER BY created_at DESC 
        LIMIT 100
      ` as DbAssociation[]
    }

    return NextResponse.json({
      success: true,
      associations,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// Request body type for PATCH (revocation)
interface RevokeAssociationRequest {
  id: number
  revokedAt?: number
  message: string      // The message that was signed
  signature: Hex       // The signature
  signer: string       // The claimed signer address
}

// PATCH to revoke an association
// Per ERC-8092: "If a previously revoked association is revoked again 
// with an earlier timestamp, the earlier timestamp MUST take precedence."
// 
// Auth: The connected wallet must sign a message, and we verify:
// 1. The signature recovers to the claimed signer
// 2. The signer is either the initiator or approver of the association
export async function PATCH(request: Request) {
  try {
    const body: RevokeAssociationRequest = await request.json()
    const { id, revokedAt, message, signature, signer } = body

    // Validate required fields
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing id' },
        { status: 400 }
      )
    }

    if (!message || !signature || !signer) {
      return NextResponse.json(
        { success: false, error: 'Missing authentication fields (message, signature, signer)' },
        { status: 400 }
      )
    }

    // Verify the signature recovers to the claimed signer
    const isValidSignature = await verifyMessage({
      address: signer as Hex,
      message,
      signature,
    })

    if (!isValidSignature) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Fetch the association to check if signer is a party
    const associations = await sql`
      SELECT initiator_address, approver_address FROM associations WHERE id = ${id}
    ` as { initiator_address: string; approver_address: string }[]

    if (associations.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Association not found' },
        { status: 404 }
      )
    }

    const association = associations[0]
    const signerLower = signer.toLowerCase()

    // Check that signer is either initiator or approver
    if (signerLower !== association.initiator_address && signerLower !== association.approver_address) {
      return NextResponse.json(
        { success: false, error: 'Signer is not a party to this association' },
        { status: 403 }
      )
    }

    // Verify the message format matches expected pattern
    const expectedTimestamp = revokedAt ?? Math.floor(Date.now() / 1000)
    const expectedMessage = `Revoke association ${id} at timestamp ${expectedTimestamp}`
    
    if (message !== expectedMessage) {
      return NextResponse.json(
        { success: false, error: 'Message format mismatch' },
        { status: 400 }
      )
    }

    // Use provided timestamp or current time
    const revocationTimestamp = BigInt(expectedTimestamp)

    // Only update if:
    // 1. Not currently revoked (revoked_at IS NULL), OR
    // 2. New timestamp is earlier than existing (earlier takes precedence per spec)
    await sql`
      UPDATE associations 
      SET revoked_at = ${revocationTimestamp}
      WHERE id = ${id}
        AND (revoked_at IS NULL OR revoked_at > ${revocationTimestamp})
    `

    return NextResponse.json({ success: true, revokedAt: revocationTimestamp.toString() })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

