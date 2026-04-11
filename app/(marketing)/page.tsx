"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LandingPage } from "@/components/features/marketing/LandingPage";

/**
 * Detects Supabase magic link tokens in the URL hash.
 * When the Supabase local instance redirects to site_url (root) after verifying a magic
 * link, this component intercepts the #access_token fragment and waits for the Supabase
 * client to establish a session, then redirects to the customer orders page.
 */
function MagicLinkHandler() {
    const router = useRouter();

    useEffect(() => {
        const hash = window.location.hash;
        if (!hash.includes("access_token") && !hash.includes("type=magiclink")) return;

        const supabase = createClient();

        // Wait for the Supabase client to process the hash and establish a session
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_IN" && session) {
                subscription.unsubscribe();
                router.push("/orders");
            }
        });

        // Fallback: if session is already established when we check
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                subscription.unsubscribe();
                router.push("/orders");
            }
        });

        return () => subscription.unsubscribe();
    }, [router]);

    return null;
}

/**
 * Root Landing Page
 */
export default function Home() {
    return (
        <>
            <MagicLinkHandler />
            <LandingPage />
        </>
    );
}
