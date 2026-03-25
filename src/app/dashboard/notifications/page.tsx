import { createClient } from '@/lib/supabase/server'
import { NotificationsClient } from './notifications-client'

export default async function NotificationsPage() {
  const supabase = await createClient()

  const { data: history } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  return <NotificationsClient history={history ?? []} />
}
