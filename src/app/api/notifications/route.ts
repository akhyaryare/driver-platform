import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { Resend } from 'resend'
import type { Database } from '@/types/database'

type NotificationInsert = Database['public']['Tables']['notifications']['Insert']
type DriverRow = Database['public']['Tables']['drivers']['Row']

export async function POST(req: NextRequest) {
  const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  )
  const resend = new Resend(process.env.RESEND_API_KEY!)
  const supabase = await createClient()

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as { role: string } | null
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as {
    title: string
    message: string
    channel: 'sms' | 'email' | 'both'
    recipients: 'all' | 'active' | 'on_route'
  }
  const { title, message, channel, recipients } = body

  if (!title || !message || !channel || !recipients) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const insertData: NotificationInsert = {
    title,
    message,
    channel,
    recipients,
    sent_by: user.id,
    status: 'pending',
  }

  // Create notification record
  const { data: notification, error: dbError } = await supabase
    .from('notifications')
    .insert(insertData)
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  // Fetch target drivers
  let driversQuery = supabase.from('drivers').select('id, name, phone, email')
  if (recipients === 'active') driversQuery = driversQuery.eq('status', 'active')
  if (recipients === 'on_route') driversQuery = driversQuery.eq('status', 'on_route')

  const { data: drivers } = await driversQuery
  const typedDrivers = (drivers ?? []) as Pick<DriverRow, 'id' | 'name' | 'phone' | 'email'>[]

  if (!typedDrivers.length) {
    await supabase.from('notifications')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', notification.id)
    return NextResponse.json({ success: true, sent: 0 })
  }

  const errors: string[] = []

  // Send SMS
  if (channel === 'sms' || channel === 'both') {
    const smsDrivers = typedDrivers.filter(d => d.phone)
    await Promise.allSettled(
      smsDrivers.map(driver =>
        twilioClient.messages.create({
          body: `[${title}] ${message}`,
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: driver.phone,
        }).catch((e: Error) => errors.push(`SMS to ${driver.name}: ${e.message}`))
      )
    )
  }

  // Send Email
  if (channel === 'email' || channel === 'both') {
    const emailRecipients = typedDrivers.filter(d => d.email).map(d => d.email!)
    if (emailRecipients.length > 0) {
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: emailRecipients,
        subject: title,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af;">${title}</h2>
            <p style="color: #374151; line-height: 1.6;">${message}</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #9ca3af; font-size: 12px;">Sent via DriverOps platform</p>
          </div>
        `,
      })
      if (error) errors.push(`Email batch: ${error.message}`)
    }
  }

  const finalStatus = errors.length === 0 ? 'sent' : (errors.length < typedDrivers.length ? 'sent' : 'failed')
  await supabase.from('notifications')
    .update({ status: finalStatus, sent_at: new Date().toISOString() })
    .eq('id', notification.id)

  return NextResponse.json({
    success: true,
    sent: typedDrivers.length,
    errors: errors.length ? errors : undefined,
  })
}
