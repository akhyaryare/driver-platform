import { createClient } from '@/lib/supabase/server'
import { Users, Map, Bell, TrendingUp } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { count: totalDrivers },
    { count: activeDrivers },
    { count: onRouteDrivers },
    { count: totalRoutes },
  ] = await Promise.all([
    supabase.from('drivers').select('*', { count: 'exact', head: true }),
    supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('drivers').select('*', { count: 'exact', head: true }).eq('status', 'on_route'),
    supabase.from('routes').select('*', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  const stats = [
    { label: 'Total Drivers', value: totalDrivers ?? 0, icon: Users, color: 'blue' },
    { label: 'Active Drivers', value: activeDrivers ?? 0, icon: TrendingUp, color: 'green' },
    { label: 'On Route', value: onRouteDrivers ?? 0, icon: Map, color: 'purple' },
    { label: 'Active Routes', value: totalRoutes ?? 0, icon: Bell, color: 'orange' },
  ]

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Fleet overview and key metrics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500">{label}</span>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
                <Icon size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
