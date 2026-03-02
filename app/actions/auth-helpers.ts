"use server";

import { createClient } from "@/lib/supabase/server";

export async function isSuperAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return false;

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    return profile?.role === "super_admin";
}

export async function isAdminOrOwner() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return false;

    // 1. Check if super admin
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (profile?.role === "super_admin") return true;

    // 2. Check if admin or owner in ANY organization
    const { data: orgMembers } = await supabase
        .from("organization_members")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "owner"])
        .limit(1);

    return orgMembers && orgMembers.length > 0;
}
