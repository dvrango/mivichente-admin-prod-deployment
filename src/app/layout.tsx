import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { EnvBanner } from '@/components/shared/env-banner'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Vichente Admin',
  description: 'Panel de administración para Vichente App',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-dvh antialiased`}>
      <body className="h-full flex flex-col overflow-hidden">
        <EnvBanner />
        {children}
      </body>
    </html>
  )
}
