'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Send, Table } from '@/components/icons'

export default function ModeTabs() {
  const path = usePathname()

  const item = (href: string, icon: React.ReactNode, label: string) => {
    const active = path === href
    return (
      <Link
        href={href}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm transition-colors ${
          active ? 'bg-white shadow-sm font-medium text-ink' : 'text-zinc-500 hover:text-zinc-700'
        }`}
      >
        {icon}
        {label}
      </Link>
    )
  }

  return (
    <div className="inline-flex bg-zinc-100 rounded-xl p-1">
      {item('/', <Send width={16} height={16} />, 'Broadcast')}
      {item('/personalisasi', <Table width={16} height={16} />, 'Personalisasi')}
    </div>
  )
}
