"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const ORG_COOKIE_NAME = "current_org_id";

/**
 * Sets the active organization ID in a cookie.
 */
export async function setActiveOrganization(orgId: string) {
    const cookieStore = await cookies();
    cookieStore.set(ORG_COOKIE_NAME, orgId, {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    // access cookies().set... which handles the response header automatically in Server Actions
    revalidatePath("/dashboard");
}

/**
 * Gets the active organization ID from the cookie.
 */
export async function getActiveOrganizationId() {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(ORG_COOKIE_NAME);
    return cookie?.value || null;
}
