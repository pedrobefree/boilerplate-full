import { createClient } from '@supabase/supabase-js'

const supabase = createClient('http://127.0.0.1:54321', 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH')

async function check() {
    const { data: invs, error: e1 } = await supabase.from('organization_invitations').select('*')
    console.log('INVITES:', JSON.stringify(invs, null, 2))
    if (e1) console.error('E1:', e1)

    const { data: mems, error: e2 } = await supabase.from('organization_members').select('*')
    console.log('MEMBERS:', JSON.stringify(mems, null, 2))
    if (e2) console.error('E2:', e2)

    const { data: profiles, error: e3 } = await supabase.from('profiles').select('*')
    console.log('PROFILES:', JSON.stringify(profiles, null, 2))
    if (e3) console.error('E3:', e3)
}

check()
