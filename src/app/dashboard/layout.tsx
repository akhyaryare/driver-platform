import { Sidebar } from '@/components/layout/sidebar'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0 p-4 lg:p-8 min-w-0">
        {children}
      </main>
    </div>
  )
}
