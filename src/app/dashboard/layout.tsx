import { Sidebar } from '@/components/layout/sidebar'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        {children}
      </main>
    </div>
  )
}
