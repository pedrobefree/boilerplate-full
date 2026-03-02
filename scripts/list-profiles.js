import { createClient } from '@supabase/supabase-js'

const supabase = createClient('http://127.0.0.1:54321', 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH')

async function listUsers() {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role')

    if (error) {
        console.error('Error:', error)
    } else {
        console.log('PROFILES:', JSON.stringify(data, null, 2))
    }
}

listUsers()
