import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Stack & Slide 🏗️', description: 'Stack blocks on a sliding tower!' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
