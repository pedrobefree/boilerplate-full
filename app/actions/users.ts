"use server";

import { createClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/supabase/errors";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { sendInvitationEmail } from "./invitations";
import { recordCurrentUserActivity } from "@/lib/activity-log";

const ACTIVE_ORG_COOKIE = "current_org_id";

async function getActiveOrg() {
    const cookieStore = await cookies();
    const orgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
    if (!orgId) throw new Error("No active organization");
    return orgId;
}

export interface OrganizationMember {
    id: string;
    user_id: string;
    role: "owner" | "admin" | "member";
    created_at: string;
    profile: {
        id: string;
        email: string;
        full_name: string | null;
        avatar_url: string | null;
    } | null;
}

export async function getOrganizationMembers(options?: { allOrgs?: boolean; organizationId?: string }) {
    return withErrorHandling(async () => {
        const supabase = await createClient();

        // 1. Get current user profile and role
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) throw new Error("Unauthorized");

        const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", currentUser.id)
            .single();
        const isSuperAdmin = profile?.role === "super_admin";

        let orgId: string | null = null;
        if (!options?.allOrgs) {
            orgId = options?.organizationId || await getActiveOrg();
        } else {
            // Only Super Admins can fetch all orgs
            if (!isSuperAdmin) throw new Error("Unauthorized: Super Admin access required");
        }

        let viewerRole = "member";
        if (orgId) {
            const { data: viewerMember } = await supabase
                .from("organization_members")
                .select("role")
                .eq("organization_id", orgId)
                .eq("user_id", currentUser.id)
                .maybeSingle();
            viewerRole = viewerMember?.role || "member";
        } else {
            // If fetching all orgs as super admin, we typically act as owner/super admin
            viewerRole = "owner";
        }

        // 2. Fetch members
        // Join organizations to get name/slug
        let query = supabase
            .from("organization_members")
            .select("id, user_id, role, created_at, organization_id, organizations(name, slug)");

        if (orgId) {
            query = query.eq("organization_id", orgId);
        }

        // RBAC: Members can only see themselves (unless Super Admin)
        // If fetching all orgs, we already checked isSuperAdmin.
        if (viewerRole === "member" && !isSuperAdmin) {
            query = query.eq("user_id", currentUser.id);
        }

        const { data: membersData, error: membersError } = await query
            .order("created_at", { ascending: true });

        if (membersError) throw membersError;
        if (!membersData || membersData.length === 0) return [];

        // Get unique user IDs
        const userIds = Array.from(new Set(membersData.map(m => m.user_id)));

        // Fetch profiles for these users
        const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id, email, full_name, avatar_url")
            .in("id", userIds);

        if (profilesError) throw profilesError;

        // Create a map of profiles by ID
        const profilesMap = new Map(
            (profilesData || []).map(p => [p.id, p])
        );

        // Format the data to combine members with their profiles
        const members = membersData.map((member) => {
            const orgData = Array.isArray(member.organizations) ? member.organizations[0] : member.organizations;
            return {
                id: member.id,
                user_id: member.user_id,
                role: member.role,
                created_at: member.created_at,
                organization: orgData ? { name: orgData.name, slug: orgData.slug } : null,
                profile: profilesMap.get(member.user_id) || null
            };
        });

        return members as (OrganizationMember & { organization: { name: string; slug: string } | null })[];
    });
}

export async function inviteMember(email: string, role: "owner" | "admin" | "member") {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const orgId = await getActiveOrg();

        // 1. Get current user profile and role
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) throw new Error("Unauthorized");

        const { data: inviterMember } = await supabase
            .from("organization_members")
            .select("role")
            .eq("organization_id", orgId)
            .eq("user_id", currentUser.id)
            .maybeSingle();

        // 2. Role Hierarchy Check
        const roleLevel = { owner: 3, admin: 2, member: 1 };
        const inviterRole = inviterMember?.role || "member";

        const { data: inviterProfile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", currentUser.id)
            .single();
        const isSuperAdmin = inviterProfile?.role === "super_admin";

        if (!isSuperAdmin && roleLevel[role] > roleLevel[inviterRole as keyof typeof roleLevel]) {
            throw new Error(`You cannot invite a user with a higher role than yours (${inviterRole}).`);
        }

        // 3. Get organization name and settings for expiration
        const { data: org } = await supabase
            .from("organizations")
            .select("name, invite_expiration_days")
            .eq("id", orgId)
            .maybeSingle();

        const expirationDays = org?.invite_expiration_days || 7;

        // 4. Check if user exists
        const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", email)
            .maybeSingle();

        if (profile) {
            // User exists - check if already a member
            const { data: existing } = await supabase
                .from("organization_members")
                .select("id")
                .eq("organization_id", orgId)
                .eq("user_id", profile.id)
                .maybeSingle();

            if (existing) {
                throw new Error("User is already a member of this organization.");
            }

            // Fall through to create invitation...
        }
        // Create invitation logic (now for both existing and new users)
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

        // Create invitation with expiration
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expirationDays);

        const { data: invitation, error: inviteError } = await supabase
            .from("organization_invitations")
            .insert({
                organization_id: orgId,
                email,
                role,
                invited_by: currentUser.id,
                expires_at: expiresAt.toISOString()
            })
            .select("token")
            .single();

        if (inviteError) throw inviteError;

        // Send invitation email
        await sendInvitationEmail(
            email,
            invitation.token,
            org?.name || "the team",
            currentUser.user_metadata?.full_name || null,
            expirationDays
        );

        await recordCurrentUserActivity({
            organizationId: orgId,
            action: "invitation_sent",
            entityType: "invitations",
            entityId: invitation.token,
            metadata: {
                email,
                role,
            },
        });

        revalidatePath("/users");
        return { success: true, type: "invitation" as const, message: "Invitation sent!" };
    });
}

export async function getOrganizationInvitations(status?: string) {
    return withErrorHandling(async () => {
        let supabase = await createClient();
        const orgId = await getActiveOrg();

        // 1. Check Super Admin status
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        const isSuperAdmin = profile?.role === "super_admin";

        // 2. If Super Admin, switch to System Client to bypass RLS
        if (isSuperAdmin) {
            const { createSystemClient } = await import("@/lib/supabase/server");
            supabase = createSystemClient();
        }

        let query = supabase
            .from("organization_invitations")
            .select("*")
            .eq("organization_id", orgId);

        if (status && status !== "all") {
            query = query.eq("status", status);
        }

        const { data, error } = await query.order("created_at", { ascending: false });

        if (error) throw error;

        // Auto-mark as expired if needed (optimistic display)
        const now = new Date().toISOString();
        return (data || []).map(invite => ({
            ...invite,
            status: (invite.status === 'pending' && invite.expires_at < now) ? 'expired' : invite.status
        }));
    });
}


export async function updateMemberRole(memberId: string, role: "owner" | "admin" | "member") {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const orgId = await getActiveOrg();
        const { data: currentMember } = await supabase
            .from("organization_members")
            .select("id, role, user_id")
            .eq("id", memberId)
            .eq("organization_id", orgId)
            .maybeSingle();

        // RBAC Check: Only admins or owners can update roles
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) throw new Error("Unauthorized");

        const { data: updaterMember } = await supabase
            .from("organization_members")
            .select("role")
            .eq("organization_id", orgId)
            .eq("user_id", currentUser.id)
            .maybeSingle();

        const updaterRole = updaterMember?.role || "member";

        const { data: updaterProfile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", currentUser.id)
            .single();
        const isSuperAdmin = updaterProfile?.role === "super_admin";

        if (updaterRole === "member" && !isSuperAdmin) {
            throw new Error("You do not have permission to update member roles.");
        }

        const { error } = await supabase
            .from("organization_members")
            .update({ role })
            .eq("id", memberId)
            .eq("organization_id", orgId);

        if (error) throw error;

        if (currentMember && currentMember.role !== role) {
            await recordCurrentUserActivity({
                organizationId: orgId,
                action: "member_role_changed",
                entityType: "members",
                entityId: memberId,
                metadata: {
                    userId: currentMember.user_id,
                    previousRole: currentMember.role,
                    nextRole: role,
                },
            });
        }

        revalidatePath("/users");
        return { success: true };
    });
}

export async function removeMember(memberId: string) {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const orgId = await getActiveOrg();

        // Don't allow removing yourself
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { data: member } = await supabase
            .from("organization_members")
            .select("user_id, role, profiles(email)")
            .eq("id", memberId)
            .single();

        if (member?.user_id === user.id) {
            throw new Error("You cannot remove yourself from the organization.");
        }

        // RBAC Check: Only admins or owners can remove members
        const { data: updaterMember } = await supabase
            .from("organization_members")
            .select("role")
            .eq("organization_id", orgId)
            .eq("user_id", user.id)
            .maybeSingle();

        const updaterRole = updaterMember?.role || "member";

        const { data: updaterProfile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();
        const isSuperAdmin = updaterProfile?.role === "super_admin";

        if (updaterRole === "member" && !isSuperAdmin) {
            throw new Error("You do not have permission to remove members.");
        }

        // Mark any accepted invitations for this user as 'user_removed'
        const memberEmail = (member as any).profiles?.email;
        if (memberEmail) {
            await supabase
                .from("organization_invitations")
                .update({
                    status: "user_removed",
                    removed_at: new Date().toISOString()
                })
                .eq("organization_id", orgId)
                .eq("email", memberEmail)
                .eq("status", "accepted");
        }

        const { error } = await supabase
            .from("organization_members")
            .delete()
            .eq("id", memberId)
            .eq("organization_id", orgId);

        if (error) throw error;

        await recordCurrentUserActivity({
            organizationId: orgId,
            action: "member_removed",
            entityType: "members",
            entityId: memberId,
            metadata: {
                userId: member?.user_id,
                email: memberEmail,
                role: (member as any)?.role,
            },
        });

        revalidatePath("/users");
        return { success: true };
    });
}

export async function updateMemberDetails(memberId: string, data: { role: "owner" | "admin" | "member"; firstName: string; lastName: string }) {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const orgId = await getActiveOrg();
        const { data: existingMember } = await supabase
            .from("organization_members")
            .select("id, role, user_id")
            .eq("id", memberId)
            .eq("organization_id", orgId)
            .maybeSingle();

        // RBAC Check: Only admins or owners can update members
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) throw new Error("Unauthorized");

        const { data: updaterMember } = await supabase
            .from("organization_members")
            .select("role")
            .eq("organization_id", orgId)
            .eq("user_id", currentUser.id)
            .maybeSingle();

        const updaterRole = updaterMember?.role || "member";

        const { data: updaterProfile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", currentUser.id)
            .single();
        const isSuperAdmin = updaterProfile?.role === "super_admin";

        if (updaterRole === "member" && !isSuperAdmin) {
            throw new Error("You do not have permission to update members.");
        }

        // 1. Update Role in organization_members
        const { error: roleError } = await supabase
            .from("organization_members")
            .update({ role: data.role })
            .eq("id", memberId)
            .eq("organization_id", orgId);

        if (roleError) throw roleError;

        // 2. Update Name in profiles
        const { data: member } = await supabase
            .from("organization_members")
            .select("user_id")
            .eq("id", memberId)
            .single();

        if (member) {
            const fullName = `${data.firstName} ${data.lastName}`.trim();
            const { error: profileError } = await supabase
                .from("profiles")
                .update({ full_name: fullName })
                .eq("id", member.user_id);

            if (profileError) throw profileError;
        }

        if (existingMember && existingMember.role !== data.role) {
            await recordCurrentUserActivity({
                organizationId: orgId,
                action: "member_role_changed",
                entityType: "members",
                entityId: memberId,
                metadata: {
                    userId: existingMember.user_id,
                    previousRole: existingMember.role,
                    nextRole: data.role,
                },
            });
        }

        revalidatePath("/users");
        return { success: true };
    });
}
