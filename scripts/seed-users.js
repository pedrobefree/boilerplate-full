import { createClient } from '@supabase/supabase-js'

const supabase = createClient('http://127.0.0.1:54321', 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImI4MTI2OWYxLTIxZDgtNGYyZS1iNzE5LWMyMjQwYTg0MGQ5MCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MjA4NTY5NjQxM30.p3xm1NpUc-k-xzPBROeg7O8pf0b8fnLktVMNZvdvLiF7RSDjW7oSyjV-_zZLXmqTtKyBK9b5QxjuM71Gch31Lg')

const users = [
    { email: 'pedro@befree.academy', password: '12345678', role: 'super_admin' },
    { email: 'pedroduarte.lc+1@gmail.com', password: '12345678', role: 'user' }
]

async function seed() {
    for (const u of users) {
        console.log(`Creating user: ${u.email}...`)

        // 1. Create user in Auth
        const { data: userData, error: createError } = await supabase.auth.admin.createUser({
            email: u.email,
            password: u.password,
            email_confirm: true
        })

        if (createError) {
            console.error(`Error creating ${u.email}:`, createError.message)
            continue
        }

        const user = userData.user
        console.log(`Successfully created user: ${user.id}`)

        // 2. Profile is auto-created by trigger, but we need to update the role for Super Admin
        if (u.role === 'super_admin') {
            console.log(`Promoting ${u.email} to super_admin...`)
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ role: 'super_admin' })
                .eq('id', user.id)

            if (profileError) {
                console.error(`Error promoting ${u.email}:`, profileError.message)
            } else {
                console.log(`User ${u.email} promoted to super_admin!`)
            }
        }
    }
    console.log('Seed completed.')
}

seed()
