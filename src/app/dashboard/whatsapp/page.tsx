import { createClient } from '@/lib/supabase/server'
import { WhatsAppClient } from './whatsapp-client'

export default async function WhatsAppPage() {
  const supabase = await createClient()
  const { data: groups } = await supabase
    .from('whatsapp_groups')
    .select('*')
    .order('created_at', { ascending: false })
  return <WhatsAppClient groups={groups ?? []} />
}
