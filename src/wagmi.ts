import { cookieStorage, createConfig, createStorage, http } from 'wagmi'
import { baseSepolia, mainnet } from 'wagmi/chains'

// Server-safe config for cookieToInitialState (no RainbowKit connectors)
// This must have the same chains and transports as the client config in providers.tsx
export function getConfig() {
  return createConfig({
    chains: [baseSepolia, mainnet],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      [baseSepolia.id]: http(),
      [mainnet.id]: http(), // For ENS resolution
    },
  })
}

declare module 'wagmi' {
  interface Register {
    config: ReturnType<typeof getConfig>
  }
}
