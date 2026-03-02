"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function useIsSuperAdmin() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const supabase = createClient();

        const checkAdmin = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) {
                    if (mounted) setIsLoading(false);
                    return;
                }

                const { data, error } = await supabase
                    .from("profiles")
                    .select("role")
                    .eq("id", user.id)
                    .single();

                if (error) {
                    console.error("Error checking admin status:", error);
                }

                if (mounted) {
                    setIsAdmin(data?.role === "super_admin");
                }
            } catch (error) {
                console.error("Failed to check admin status:", error);
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        checkAdmin();

        return () => {
            mounted = false;
        };
    }, []);

    return { isAdmin, isLoading };
}
