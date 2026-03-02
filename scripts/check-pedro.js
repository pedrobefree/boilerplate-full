import { createClient } from '@supabase/supabase-js'

const supabase = createClient('http://127.0.0.1:54321', 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH')

async function check() {
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'pedro@befree.academy')
        .maybeSingle()

    if (error) {
        console.error('Error:', error)
    } else if (profile) {
        console.log('User found in profiles:', JSON.stringify(profile, null, 2))
    } else {
        console.log('User not found in profiles table.')
    }
}

check()
