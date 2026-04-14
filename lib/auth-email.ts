import { createSystemClient } from "@/lib/supabase/server";
import {
    buildAppUrl,
    sendCustomerWelcomeSetPasswordEmail,
    sendPasswordResetEmail,
} from "@/lib/email";

interface TriggerPasswordEmailArgs {
    email: string;
    mode?: "reset" | "welcome";
    recipientName?: string | null;
    orderNumber?: string;
    allowWithoutProfile?: boolean;
}

async function generateRecoveryLink(email: string) {
    const supabase = createSystemClient();
    const redirectTo = buildAppUrl("/auth/update-password");

    const { data, error } = await supabase.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
            redirectTo,
        },
    });

    if (error) {
        throw error;
    }

    return data.properties.action_link;
}

export async function triggerPasswordEmail({
    email,
    mode = "reset",
    recipientName,
    orderNumber,
    allowWithoutProfile = false,
}: TriggerPasswordEmailArgs) {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
        return { success: true };
    }

    const supabase = createSystemClient();
    const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("email", normalizedEmail)
        .maybeSingle();

    if (error) {
        console.error("[auth-email] Failed to resolve profile for password email", error);
        return { success: true };
    }

    if (!profile?.email && !allowWithoutProfile) {
        return { success: true };
    }

    try {
        const targetEmail = profile?.email || normalizedEmail;
        const recoveryLink = await generateRecoveryLink(targetEmail);

        if (mode === "welcome") {
            await sendCustomerWelcomeSetPasswordEmail({
                to: targetEmail,
                resetUrl: recoveryLink,
                recipientName: recipientName || profile?.full_name,
                orderNumber: orderNumber || "recente",
            });
        } else {
            await sendPasswordResetEmail({
                to: targetEmail,
                resetUrl: recoveryLink,
                recipientName: recipientName || profile?.full_name,
            });
        }
    } catch (sendError) {
        console.error("[auth-email] Failed to issue password recovery email", sendError);
    }

    return { success: true };
}
