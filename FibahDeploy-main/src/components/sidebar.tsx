'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FolderOpen, Map, FileText, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Projects', href: '/dashboard', icon: FolderOpen },
  { name: 'Map Interface', href: '/dashboard/map', icon: Map },
  { name: 'Field Notes', href: '/dashboard/notes', icon: FileText },
  { name: 'My Profile', href: '/dashboard/profile', icon: User },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-screen w-64 flex-col bg-gradient-to-b from-[#2c5f4f] to-[#1e4438] text-white">
      {/* Logo/Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
          <FolderOpen className="h-6 w-6" />
        </div>
        <div>
          <div className="text-base font-semibold">Field Data</div>
          <div className="text-xs text-white/70">Fiber Construction</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
