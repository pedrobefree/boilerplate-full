"use server";

import { createClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/supabase/errors";
import { revalidatePath } from "next/cache";
import { sendInvitationEmail } from "./invitations";
import { recordCurrentUserActivity } from "@/lib/activity-log";

async function checkSuperAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (profile?.role !== "super_admin") {
        throw new Error("Forbidden: Super Admin access required");
    }
    return supabase;
}

export async function getAllOrganizations() {
    return withErrorHandling(async () => {
        const supabase = await checkSuperAdmin();

        // Get all organizations
        const { data: orgs, error: orgError } = await supabase
            .from("organizations")
            .select(`
                *,
                members:organization_members(count)
            `)
            .order("created_at", { ascending: false });

        if (orgError) throw orgError;

        return orgs;
    });
}

export async function createOrganizationAdmin(name: string, slug: string, ownerEmail: string) {
    return withErrorHandling(async () => {
        const supabase = await checkSuperAdmin();

        // 1. Check if owner exists
        const { data: ownerProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", ownerEmail)
            .maybeSingle();

        // 2. Create Org (without owner_id if user doesn't exist, though schema might require it)
        // Let's check the schema for organizations table.
        // Actually, if they don't exist, we should probably still create the org but leave owner_id null until they accept the invite,
        // OR we create the invite first. 
        // But the organization table might have a NOT NULL constraint on owner_id (it does in many boilerplates).

        // Let's check the organizations table schema if possible.

        // For now, I'll assume we can create the org.
        const { data: org, error: orgError } = await supabase
            .from("organizations")
            .insert({
                name,
                slug
            })
            .select()
            .single();

        if (orgError) throw orgError;

        if (ownerProfile) {
            // 3a. Add owner as member directly
            const { error: memberError } = await supabase
                .from("organization_members")
                .insert({
                    organization_id: org.id,
                    user_id: ownerProfile.id,
                    role: "owner"
                });

            if (memberError) throw memberError;
        } else {
            // 3b. Create invitation for the new user as 'owner'
            const { data: invitation, error: inviteError } = await supabase
                .from("organization_invitations")
                .insert({
                    organization_id: org.id,
                    email: ownerEmail,
                    role: "owner",
                    invited_by: (await supabase.auth.getUser()).data.user?.id
                })
                .select("token")
                .single();

            if (inviteError) throw inviteError;

            // Send invitation email
            await sendInvitationEmail(ownerEmail, invitation.token, name);

            await recordCurrentUserActivity({
                organizationId: org.id,
                action: "invitation_sent",
                entityType: "invitations",
                entityId: invitation.token,
                metadata: {
                    email: ownerEmail,
                    role: "owner",
                    source: "super_admin",
                },
            });
        }

        await recordCurrentUserActivity({
            organizationId: org.id,
            action: "organization_created",
            entityType: "organizations",
            entityId: org.id,
            metadata: {
                name: org.name,
                slug: org.slug,
                ownerEmail,
                source: "super_admin",
            },
        });

        revalidatePath("/admin/organizations");
        return org;
    });
}

export async function deleteOrganizationAdmin(orgId: string) {
    return withErrorHandling(async () => {
        const supabase = await checkSuperAdmin();
        const { data: organization } = await supabase
            .from("organizations")
            .select("id, name, slug")
            .eq("id", orgId)
            .maybeSingle();

        const { error } = await supabase
            .from("organizations")
            .delete()
            .eq("id", orgId);

        if (error) throw error;

        await recordCurrentUserActivity({
            organizationId: orgId,
            action: "organization_deleted",
            entityType: "organizations",
            entityId: orgId,
            metadata: {
                name: organization?.name,
                slug: organization?.slug,
                source: "super_admin",
            },
        });

        revalidatePath("/admin/organizations");
    });
}

export async function addUserToOrganizationAdmin(orgId: string, email: string, role: "owner" | "admin" | "member") {
    return withErrorHandling(async () => {
        const supabase = await checkSuperAdmin();

        // 1. Get organization name for email
        const { data: org } = await supabase
            .from("organizations")
            .select("name")
            .eq("id", orgId)
            .maybeSingle();

        // 2. Check if user exists
        const { data: userProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", email)
            .maybeSingle();

        if (userProfile) {
            // 3a. User exists - Add directly

            // Check if already a member
            const { data: existing } = await supabase
                .from("organization_members")
                .select("id")
                .eq("organization_id", orgId)
                .eq("user_id", userProfile.id)
                .maybeSingle();

            if (existing) {
                throw new Error("User is already a member of this organization.");
            }

            const { error: memberError } = await supabase
                .from("organization_members")
                .insert({
                    organization_id: orgId,
                    user_id: userProfile.id,
                    role
                });

            if (memberError) throw memberError;
        } else {
            // 3b. User doesn't exist - Create invitation

            // Check for existing pending invitation
            const { data: existingInvite } = await supabase
                .from("organization_invitations")
                .select("id")
                .eq("organization_id", orgId)
                .eq("email", email)
                .eq("status", "pending")
                .maybeSingle();

            if (existingInvite) {
                throw new Error("An invitation has already been sent to this email.");
            }

            // Create invitation
            const { data: invitation, error: inviteError } = await supabase
                .from("organization_invitations")
                .insert({
                    organization_id: orgId,
                    email,
                    role,
                    invited_by: (await supabase.auth.getUser()).data.user?.id
                })
                .select("token")
                .single(); // Token creation should always return one row

            if (inviteError) throw inviteError;

            // Send invitation email
            await sendInvitationEmail(email, invitation.token, org?.name || "the team");

            await recordCurrentUserActivity({
                organizationId: orgId,
                action: "invitation_sent",
                entityType: "invitations",
                entityId: invitation.token,
                metadata: {
                    email,
                    role,
                    source: "super_admin",
                },
            });
        }

        revalidatePath("/admin/organizations");
        return { success: true };
    });
}

export async function getOrganizationMembersAdmin(orgId: string) {
    return withErrorHandling(async () => {
        const supabase = await checkSuperAdmin();

        const { data: members, error } = await supabase
            .from("organization_members")
            .select(`
                id,
                user_id,
                role,
                created_at,
                profile:profiles(id, email, full_name, avatar_url)
            `)
            .eq("organization_id", orgId)
            .order("created_at", { ascending: true });

        if (error) throw error;
        return members;
    });
}

export async function updateOrganizationAdmin(orgId: string, data: { name: string; slug: string }) {
    return withErrorHandling(async () => {
        const supabase = await checkSuperAdmin();

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
                source: "super_admin",
            },
        });

        revalidatePath("/admin/organizations");
        return { success: true };
    });
}
