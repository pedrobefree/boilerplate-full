"use client";

import { useEffect, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/features/auth/AuthProvider";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { createClient } from "@/lib/supabase/client";
import { getUserAccessContext, resolveAuthorizedPath } from "@/lib/auth/redirects";

function AuthConfirmContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isLoading } = useAuth();
    const next = searchParams.get("next") || "/orders";
    useEffect(() => {
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        const search = typeof window !== 'undefined' ? window.location.search : '';

        const hasHashToken = hash.includes('access_token');
        const hasError = hash.includes('error=') || search.includes('error=');

        if (hasError) {
            router.push("/login?error=" + encodeURIComponent("Invalid or expired link"));
            return;
        }

        if (hasHashToken) {
            // Clear the hash from the browser immediately so React Strict Mode doesn't double-process the token
            // which causes the session to instantly invalidate due to consumed PKCE codes/refresh tokens.
            window.history.replaceState(null, '', window.location.pathname + window.location.search);

            // Supabase SSR uses PKCE by default, so it might ignore the implicit flow hash (#access_token).
            // We parse it manually to guarantee the session is established.
            const hashParams = new URLSearchParams(hash.substring(1));
            const access_token = hashParams.get('access_token');
            const refresh_token = hashParams.get('refresh_token');

            if (access_token && refresh_token) {
                const supabase = createClient();
                
                supabase.auth.setSession({ access_token, refresh_token }).then(async ({ data, error }) => {
                    if (error) {
                        router.push("/login?error=" + encodeURIComponent("Invalid or expired link"));
                    } else if (data.session?.user) {
                        const targetPath = resolveAuthorizedPath(
                            await getUserAccessContext(supabase, data.session.user.id),
                            next
                        );
                        // Give it half a second for AuthProvider to catch up via its own onAuthStateChange
                        setTimeout(() => {
                            router.push(targetPath);
                        }, 500);
                    }
                });
            } else {
                router.push("/login?error=" + encodeURIComponent("Invalid or expired link"));
            }
            return;
        }

        // Fallback for PKCE or standard redirects that didn't have a hash
        if (!isLoading) {
            if (user) {
                const redirectUser = async () => {
                    const supabase = createClient();
                    const targetPath = resolveAuthorizedPath(
                        await getUserAccessContext(supabase, user.id),
                        next
                    );
                    router.push(targetPath); 
                };
                redirectUser();
            } else if (!hasHashToken) {
                router.push("/login?error=Invalid+or+expired+magic+link");
            }
        }
    }, [user, isLoading, router, next]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
            <LoadingIndicator size="lg" />
            <p className="mt-4 text-gray-500 font-medium tracking-tight">Authenticating securely...</p>
        </div>
    );
}

export default function AuthConfirmPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <LoadingIndicator size="lg" />
            </div>
        }>
            <AuthConfirmContent />
        </Suspense>
    );
}
