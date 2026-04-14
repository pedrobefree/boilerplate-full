"use server";

import { triggerPasswordEmail } from "@/lib/auth-email";

export async function requestPasswordResetEmail(args: {
    email: string;
    mode?: "reset" | "welcome";
    recipientName?: string | null;
    orderNumber?: string;
}) {
    return triggerPasswordEmail(args);
}
