import { createClient } from '@/lib/supabase/server'
import { RoutesClient } from './routes-client'

export default async function RoutesPage() {
  const supabase = await createClient()

  const { data: routes } = await supabase
    .from('routes')
    .select('id, name, route_number, description, status, created_at')
    .order('route_number', { ascending: true })
    .limit(500)

  return <RoutesClient routes={routes ?? []} />
}
