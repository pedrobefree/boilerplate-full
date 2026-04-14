"use server";

import { createClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/supabase/errors";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { recordCurrentUserActivity } from "@/lib/activity-log";

const ACTIVE_ORG_COOKIE = "current_org_id";

async function getActiveOrg() {
    const cookieStore = await cookies();
    const orgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
    if (!orgId) throw new Error("No active organization");
    return orgId;
}

export async function updateOrganizationDetails(data: {
    name?: string;
    slug?: string;
    invite_expiration_days?: number;
}) {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const orgId = await getActiveOrg();

        // Check permissions (Owner or Super Admin)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const [{ data: members }, { data: profile }] = await Promise.all([
            supabase
                .from("organization_members")
                .select("role")
                .eq("organization_id", orgId)
                .eq("user_id", user.id),
            supabase
                .from("profiles")
                .select("role")
                .eq("id", user.id)
                .maybeSingle()
        ]);

        const roles = members?.map(m => m.role) || [];
        const isOwner = roles.includes("owner");
        const isAdmin = roles.includes("admin");
        const isSuperAdmin = profile?.role === "super_admin";

        if (!isOwner && !isAdmin && !isSuperAdmin) {
            throw new Error("Only organization owners or admins can modify organization settings.");
        }

        const { error } = await supabase
            .from("organizations")
            .update(data)
            .eq("id", orgId);

        if (error) throw error;

        await recordCurrentUserActivity({
            organizationId: orgId,
            action: "organization_updated",
            entityType: "organizations",
            entityId: orgId,
            metadata: {
                updates: data,
            },
        });

        revalidatePath("/settings");
        revalidatePath("/users");
        return { success: true };
    });
}

export async function createOrganization(name: string, slug: string) {
    return withErrorHandling(async () => {
        const supabase = await createClient();

        // 1. Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        // 2. Create organization
        const { data: org, error: orgError } = await supabase
            .from("organizations")
            .insert({
                name,
                slug
            })
            .select()
            .single();

        if (orgError) throw orgError;

        // 3. Add user as owner in organization_members
        const { error: memberError } = await supabase
            .from("organization_members")
            .insert({
                organization_id: org.id,
                user_id: user.id,
                role: "owner"
            });

        if (memberError) throw memberError;

        await recordCurrentUserActivity({
            organizationId: org.id,
            action: "organization_created",
            entityType: "organizations",
            entityId: org.id,
            metadata: {
                name: org.name,
                slug: org.slug,
            },
        });

        revalidatePath("/dashboard");
        return org;
    });
}

export async function getMyOrganizations() {
    return withErrorHandling(async () => {
        const supabase = await createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        // Check if user is super admin
        const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        const isSuperAdmin = profile?.role === "super_admin";

        if (isSuperAdmin) {
            // Super Admins see all organizations
            const { data, error } = await supabase
                .from("organizations")
                .select(`*`)
                .order("name");

            if (error) throw error;

            // Map to expected structure (simulate member role if needed, or leave empty)
            // The Context expects 'organization_members' array to extract role. 
            // We can return clean organizations, and the context map will result in undefined role, which is handled.
            return data.map(org => ({
                ...org,
                organization_members: [] // No specific member role for Super Admin view (or we could fetch it)
            }));
        }

        const { data, error } = await supabase
            .from("organizations")
            .select(`
                *,
                organization_members!inner(role)
            `)
            .eq("organization_members.user_id", user.id);

        if (error) throw error;
        return data;
    });
}

export async function getOrganizationMembers() {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const orgId = await getActiveOrg();

        const { data, error } = await supabase
            .from("organization_members")
            .select(`
                user_id,
                role,
                profile:profiles!user_id(id, full_name, avatar_url, email)
            `)
            .eq("organization_id", orgId);

        if (error) throw error;
        return data.map(m => ({
            id: m.user_id,
            role: m.role,
            ...m.profile
        }));
    }, { action: "getOrganizationMembers" });
}
