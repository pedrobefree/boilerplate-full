import { createClient } from '@supabase/supabase-js'

const supabase = createClient('http://127.0.0.1:54321', 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH')

async function findUser() {
    // Note: We can't query auth.users directly via REST unless we have service role, 
    // but we can check if it exists in profiles now (if they signed up)
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', 'pedro@befree.academy')
        .single()

    if (error) {
        console.error('Error finding profile:', error.message)
    } else {
        console.log('USER_ID:', profile.id)
    }
}

findUser()
