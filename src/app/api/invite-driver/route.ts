import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { driverId, email, password } = await req.json()

  if (!driverId || !email || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = createAdminClient()

  let userId: string

  // Try to create a new auth user
  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError) {
    if (!createError.message.toLowerCase().includes('already been registered')) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    // User already exists — find them by email in profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User exists but could not be found. Try a different email.' }, { status: 400 })
    }

    userId = profile.id

    // Update their password so the credentials you set are valid
    await supabase.auth.admin.updateUserById(userId, { password })
  } else {
    userId = userData.user.id
  }

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
