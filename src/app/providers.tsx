'use client'

import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { type State, WagmiProvider, http } from 'wagmi'
import { baseSepolia, mainnet } from 'wagmi/chains'

// Singleton pattern to prevent multiple WalletConnect Core initializations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let config: any = null

function getConfig() {
  if (!config) {
    config = getDefaultConfig({
      appName: 'ERC-8092 Demo',
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'ffff890acd298e25d2bc1580ff98b810',
      // mainnet included for ENS resolution
      chains: [baseSepolia, mainnet],
      ssr: true,
      transports: {
        // Provide public RPC URLs as fallbacks in case wallet doesn't have these networks configured
        [baseSepolia.id]: http('https://sepolia.base.org'),
        [mainnet.id]: http('https://eth.llamarpc.com'),
      },
    })
  }
  return config
}

export function Providers(props: {
  children: ReactNode
  initialState?: State
}) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={getConfig()} initialState={props.initialState}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#00d4ff',
            accentColorForeground: '#000',
            borderRadius: 'medium',
            fontStack: 'system',
          })}
          modalSize="compact"
        >
          {props.children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
