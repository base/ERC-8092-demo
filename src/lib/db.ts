import { neon } from '@neondatabase/serverless'

// Create a Neon serverless client
// DATABASE_URL is automatically provided by Neon's Vercel integration
export const sql = neon(process.env.DATABASE_URL!)

// Types for database operations
export interface DbAssociation {
  id: number
  initiator_address: string
  approver_address: string
  initiator_bytes: string
  approver_bytes: string
  valid_at: string // bigint comes as string from postgres
  valid_until: string | null
  interface_id: string | null
  data: string | null
  revoked_at: string | null
  initiator_key_type: string
  approver_key_type: string
  initiator_signature: string
  approver_signature: string
  created_at: string
}

