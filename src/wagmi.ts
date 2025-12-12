import { cookieStorage, createConfig, createStorage, http } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'

// Server-safe config for cookieToInitialState (no RainbowKit connectors)
// This must have the same chains and transports as the client config in providers.tsx
export function getConfig() {
  return createConfig({
    chains: [baseSepolia],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      // Provide public RPC URLs as fallbacks in case wallet doesn't have these networks configured
      [baseSepolia.id]: http('https://sepolia.base.org'),
    },
  })
}

declare module 'wagmi' {
  interface Register {
    config: ReturnType<typeof getConfig>
  }
}
