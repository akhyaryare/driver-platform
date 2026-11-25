import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const caller = await createClient()
  const { data: { user }, error: authError } = await caller.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data: profile, error: profileError } = await caller
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profileError || profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { driverId, email, password } = await req.json()

  if (!driverId || !email || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: targetDriver, error: driverError } = await supabase
    .from('drivers')
    .select('id, profile_id')
    .eq('id', driverId)
    .is('profile_id', null)
    .single()
  if (driverError || !targetDriver || targetDriver.profile_id) {
    return NextResponse.json({ error: 'Driver not found or already linked' }, { status: 400 })
  }

  let userId: string

  // Try to create a new auth user
  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError) {
    // Never reset credentials of an existing user during driver invitation.
    return NextResponse.json({ error: 'Unable to create driver account. Use a different email.' }, { status: 400 })
  }
  userId = userData.user.id

  // Ensure profile has driver role
  await supabase.from('profiles').upsert({
    id: userId,
    email,
    full_name: email,
    role: 'driver',
  })

  // Link to driver record
  const { error: linkError } = await supabase
    .from('drivers')
    .update({ profile_id: userId })
    .eq('id', driverId)

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
