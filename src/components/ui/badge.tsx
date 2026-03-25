import { cn } from '@/lib/utils'

type BadgeVariant = 'active' | 'inactive' | 'on_route' | 'pending' | 'in_progress' | 'completed' | 'sent' | 'failed' | 'default'

const variants: Record<BadgeVariant, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  on_route: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  sent: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  default: 'bg-gray-100 text-gray-700',
}

export function Badge({ value, label }: { value: string; label?: string }) {
  const variant = (variants[value as BadgeVariant] ?? variants.default)
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', variant)}>
      {label ?? value.replace('_', ' ')}
    </span>
  )
}
