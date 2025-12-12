import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { headers } from 'next/headers'
import { type ReactNode } from 'react'
import { cookieToInitialState } from 'wagmi'

import { getConfig } from '../wagmi'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ERC-8092 Demo | Associated Accounts',
  description: 'Interactive demo for ERC-8092 Associated Accounts standard',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'ERC-8092 Demo | Associated Accounts',
    description: 'Interactive demo for ERC-8092: Associated Accounts',
    url: 'https://erc8092.xyz',
    siteName: 'ERC-8092 Demo',
    images: [
      {
        url: '/og-image.png',
        width: 322,
        height: 348,
        alt: 'ERC-8092 Associated Accounts Demo',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ERC-8092 Demo | Associated Accounts',
    description: 'Interactive demo for ERC-8092 Associated Accounts standard',
    images: ['/og-image.png'],
  },
}

export default async function RootLayout(props: { children: ReactNode }) {
  const initialState = cookieToInitialState(
    getConfig(),
    (await headers()).get('cookie'),
  )
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers initialState={initialState}>{props.children}</Providers>
      </body>
    </html>
  )
}
