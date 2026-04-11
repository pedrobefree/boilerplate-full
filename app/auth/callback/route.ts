import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordCurrentUserActivity } from "@/lib/activity-log";
import { getUserAccessContext, resolveAuthorizedPath } from "@/lib/auth/redirects";

/**
 * GET handler for Supabase OAuth callbacks.
 * Exchanges the code for a session and redirects to the dashboard.
 * 
 * @param {Request} request
 */
export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    // if "next" is in search params, use it as the redirect URL
    const next = searchParams.get("next");

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            const { data: { user } } = await supabase.auth.getUser();

            await recordCurrentUserActivity({
                action: "login",
                entityType: "auth",
                entityId: "oauth",
                metadata: {
                    provider: "oauth",
                },
            });

            const targetPath = user
                ? resolveAuthorizedPath(await getUserAccessContext(supabase, user.id), next)
                : "/dashboard";

            const forwardedHost = request.headers.get("x-forwarded-host"); // covers Vercel/proxies
            const isLocalEnv = process.env.NODE_ENV === "development";

            if (isLocalEnv) {
                // we can use the origin for local dev
                return NextResponse.redirect(`${origin}${targetPath}`);
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${targetPath}`);
            } else {
                return NextResponse.redirect(`${origin}${targetPath}`);
            }
        }

        // Log the error for server-side troubleshooting
        console.error("OAuth callback error:", error);
    }

    // Return the user to an error page with some instructions
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
