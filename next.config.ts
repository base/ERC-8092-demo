import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Externalize Node.js-only packages to prevent bundling issues during SSR
  serverExternalPackages: ['pino', 'pino-pretty', 'thread-stream'],

  webpack: (config) => {
    // Handle pino-pretty and other optional dependencies that WalletConnect/pino try to load
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'pino-pretty': false,
      encoding: false,
      lokijs: false,
      '@react-native-async-storage/async-storage': false,
    }

    return config
  },
}

export default nextConfig
