import { createClient } from '@supabase/supabase-js'

const supabase = createClient('http://127.0.0.1:54321', 'eyJhbGciOiJFUzI1NiIsImtpZCI6ImI4MTI2OWYxLTIxZDgtNGYyZS1iNzE5LWMyMjQwYTg0MGQ5MCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MjA4NTY5NjQxM30.p3xm1NpUc-k-xzPBROeg7O8pf0b8fnLktVMNZvdvLiF7RSDjW7oSyjV-_zZLXmqTtKyBK9b5QxjuM71Gch31Lg')

async function promote() {
    // 1. Find user in auth.users (via RPC or direct table access if enabled, but usually we use profiles)
    // Actually with service role we can just select from profiles even if it's empty to see if there's an issue

    // Let's try to get all users directly via auth schema if possible
    const { data: users, error: e1 } = await supabase.auth.admin.listUsers()
    if (e1) {
        console.error('E1:', e1)
        return
    }

    const user = users.users.find(u => u.email === 'pedro@befree.academy')
    if (!user) {
        console.log('User pedro@befree.academy not found in auth.users')
        console.log('Available users:', users.users.map(u => u.email))
        return
    }

    console.log('Found user:', user.id)

    // 2. Upsert into public.profiles as super_admin
    const { data, error: e2 } = await supabase
        .from('profiles')
        .upsert({
            id: user.id,
            email: user.email,
            role: 'super_admin',
            updated_at: new Date().toISOString()
        })
        .select()

    if (e2) {
        console.error('E2:', e2)
    } else {
        console.log('Promoted successfully:', data)
    }
}

promote()
