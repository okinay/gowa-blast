import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import { Settings, Send } from '@/components/icons'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Gowa Blast',
  description: 'WhatsApp Blast via Gowa API',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`h-full ${inter.variable}`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-white/80 backdrop-blur-md">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <span
                className="flex items-center justify-center w-9 h-9 rounded-xl text-white shadow-sm"
                style={{ background: 'linear-gradient(150deg, #25d366 0%, #178a48 100%)' }}
              >
                <Send width={18} height={18} className="-rotate-12" />
              </span>
              <span className="flex flex-col leading-none">
                <span className="font-semibold text-[15px] text-ink tracking-tight">Gowa Blast</span>
                <span className="text-[11px] text-zinc-400 mt-0.5">WhatsApp broadcaster</span>
              </span>
            </Link>
            <Link
              href="/settings"
              className="text-sm text-zinc-600 hover:text-ink flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-zinc-100 transition-colors"
            >
              <Settings width={17} height={17} />
              <span className="hidden sm:inline">Settings</span>
            </Link>
          </div>
        </header>
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-7">{children}</main>
      </body>
    </html>
  )
}
