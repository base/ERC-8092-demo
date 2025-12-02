import { cookieStorage, createConfig, createStorage, http } from 'wagmi'
import { baseSepolia, mainnet } from 'wagmi/chains'

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
