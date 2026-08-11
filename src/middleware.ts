import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// A simple in-memory rate limit store.
// Note: In a production environment with multiple instances (serverless), 
// replacing this with Redis (e.g., Upstash) is recommended for distributed tracking.
const rateLimitMap = new Map<string, { count: number; lastReset: number }>()

const WINDOW_SIZE_MS = 60 * 1000 // Time window: 1 minute
const MAX_REQUESTS = 20 // Maximum requests per window (DoS protection)

export function middleware(request: NextRequest) {
  // Protect the /api/associations endpoint where heavy signature validation occurs
  if (request.nextUrl.pathname.startsWith('/api/associations')) {
    // Get the requestor's IP address
    const ip = request.headers.get('x-forwarded-for') ?? 
               request.headers.get('x-real-ip') ?? 
               '127.0.0.1'
               
    const now = Date.now()
    const requestData = rateLimitMap.get(ip)

    if (!requestData) {
      // First time seeing this IP, initialize tracking
      rateLimitMap.set(ip, { count: 1, lastReset: now })
    } else {
      // If the time window expired, reset the counter
      if (now - requestData.lastReset > WINDOW_SIZE_MS) {
        rateLimitMap.set(ip, { count: 1, lastReset: now })
      } else {
        // If rate limit is exceeded within the window, reject the request (429)
        if (requestData.count >= MAX_REQUESTS) {
          return new NextResponse(
            JSON.stringify({ 
              success: false, 
              error: 'Too Many Requests - Rate limit exceeded. Please try again later.' 
            }),
            { 
              status: 429, 
              headers: { 'content-type': 'application/json' } 
            }
          )
        }
        // Still within limits, increment the counter
        requestData.count += 1
        rateLimitMap.set(ip, requestData)
      }
    }
  }

  // Continue processing the request
  return NextResponse.next()
}

// Optimize performance by restricting the middleware to specific API routes
export const config = {
  matcher: '/api/associations/:path*',
}