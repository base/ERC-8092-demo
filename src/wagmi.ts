import { cookieStorage, createConfig, createStorage, http } from 'wagmi'
import { base, baseSepolia, mainnet } from 'wagmi/chains'

// Server-safe config for cookieToInitialState (no RainbowKit connectors)
// This must have the same chains and transports as the client config in providers.tsx
export function getConfig() {
  return createConfig({
    // Include Base mainnet for smart wallet support
    chains: [baseSepolia, base, mainnet],
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
    transports: {
      [baseSepolia.id]: http(),
      [base.id]: http(), // For Base Account smart wallets
      [mainnet.id]: http(), // For ENS resolution
    },
  })
}

declare module 'wagmi' {
  interface Register {
    config: ReturnType<typeof getConfig>
  }
}
