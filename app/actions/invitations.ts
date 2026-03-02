"use server";

import { createClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/supabase/errors";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const ACTIVE_ORG_COOKIE = "current_org_id";

async function getActiveOrg() {
    const cookieStore = await cookies();
    const orgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
    if (!orgId) throw new Error("No active organization");
    return orgId;
}

export interface Invitation {
    id: string;
    organization_id: string;
    email: string;
    role: "owner" | "admin" | "member";
    token: string;
    status: "pending" | "accepted" | "expired" | "cancelled";
    expires_at: string;
    created_at: string;
    organization?: {
        name: string;
        slug: string;
        logo_url: string | null;
    };
}

/**
 * Get a pending invitation by its token
 */
export async function getInvitationByToken(token: string) {
    return withErrorHandling(async () => {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from("organization_invitations")
            .select(`
                id,
                organization_id,
                email,
                role,
                token,
                status,
                expires_at,
                created_at,
                organizations:organization_id(name, slug, logo_url)
            `)
            .eq("token", token)
            .eq("status", "pending")
            .gt("expires_at", new Date().toISOString())
            .single();

        if (error) {
            if (error.code === "PGRST116") {
                return null; // Not found
            }
            throw error;
        }

        // Handle organization join which returns an array
        const org = Array.isArray(data.organizations) ? data.organizations[0] : data.organizations;

        return {
            ...data,
            organization: org
        } as Invitation;
    });
}

/**
 * Accept an invitation after user has signed up
 */
export async function acceptInvitation(token: string) {
    return withErrorHandling(async () => {
        const supabase = await createClient();

        // Use the database function to accept the invitation
        const { data, error } = await supabase.rpc("accept_invitation", {
            invite_token: token
        });

        if (error) throw error;

        if (!data?.success) {
            throw new Error(data?.error || "Failed to accept invitation");
        }

        revalidatePath("/users");
        return data;
    });
}

/**
 * Get all pending invitations for the current organization
 */
export async function getPendingInvitations() {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const orgId = await getActiveOrg();

        const { data, error } = await supabase
            .from("organization_invitations")
            .select("*")
            .eq("organization_id", orgId)
            .eq("status", "pending")
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false });

        if (error) throw error;
        return data as Invitation[];
    });
}

/**
 * Get pending invitations for the current user (by email)
 */
export async function getMyInvitations() {
    return withErrorHandling(async () => {
        const supabase = await createClient();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !user.email) return []; // Not logged in or no email

        const { data, error } = await supabase
            .from("organization_invitations")
            .select(`
                *,
                organizations:organization_id(name, slug, logo_url)
            `)
            .eq("email", user.email)
            .eq("status", "pending")
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false });

        if (error) throw error;

        // Transform result to match Invitation interface structure
        return (data || []).map(invite => ({
            ...invite,
            organization: Array.isArray(invite.organizations) ? invite.organizations[0] : invite.organizations
        })) as Invitation[];
    });
}

/**
 * Cancel a pending invitation
 */
export async function cancelInvitation(invitationId: string) {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const orgId = await getActiveOrg();

        const { error } = await supabase
            .from("organization_invitations")
            .update({ status: "cancelled" })
            .eq("id", invitationId)
            .eq("organization_id", orgId)
            .eq("status", "pending");

        if (error) throw error;

        revalidatePath("/users");
        return { success: true };
    });
}

/**
 * Resend an invitation email
 */
export async function resendInvitation(invitationId: string) {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const orgId = await getActiveOrg();

        // Get the invitation and organization settings
        const { data: invitation, error: fetchError } = await supabase
            .from("organization_invitations")
            .select(`
                *,
                organizations:organization_id(name, invite_expiration_days)
            `)
            .eq("id", invitationId)
            .eq("organization_id", orgId)
            .single();

        if (fetchError || !invitation) {
            throw new Error("Invitation not found");
        }

        const org = Array.isArray(invitation.organizations) ? invitation.organizations[0] : invitation.organizations;
        const expirationDays = org?.invite_expiration_days || 7;

        // Generate new token and extend expiry
        const newToken = encodeURIComponent(crypto.randomUUID().replace(/-/g, ""));
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + expirationDays);

        const { error: updateError } = await supabase
            .from("organization_invitations")
            .update({
                token: newToken,
                expires_at: newExpiry.toISOString(),
                status: "pending" // Reset status if it was expired
            })
            .eq("id", invitationId);

        if (updateError) throw updateError;

        // Send email
        await sendInvitationEmail(invitation.email, newToken, org?.name || "the team");

        revalidatePath("/users");
        return { success: true };
    });
}

/**
 * Send invitation email via Supabase
 */
export async function sendInvitationEmail(email: string, token: string, orgName: string) {
    // For local development, we'll use Supabase's built-in Inbucket
    // In production, you would use Resend or another email provider

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${appUrl}/signup?invite=${token}`;

    // For now, we'll just log the email - in production, integrate with email service
    console.log(`
    ========================================
    📧 INVITATION EMAIL
    ========================================
    To: ${email}
    Subject: You've been invited to join ${orgName}
    
    You've been invited to join ${orgName} on Befree.
    
    Click the link below to accept the invitation:
    ${inviteUrl}
    
    This invitation expires in 7 days.
    ========================================
    `);

    // TODO: In production, use Resend or Supabase Edge Function
    // Example with Resend:
    // await resend.emails.send({
    //     from: "noreply@befree.app",
    //     to: email,
    //     subject: `You've been invited to join ${orgName}`,
    //     html: `<p>Click <a href="${inviteUrl}">here</a> to accept</p>`
    // });

    return true;
}
