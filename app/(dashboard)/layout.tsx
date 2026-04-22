import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserAccessContext } from "@/lib/auth/redirects";
import DashboardLayoutClient from "@/components/features/dashboard/DashboardLayoutClient";

export const dynamic = "force-dynamic";

/**
 * Dashboard Layout
 * Wraps all dashboard pages in the sidebar and top navigation.
 */
export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const access = await getUserAccessContext(supabase, user.id);

    if (!access.hasDashboardAccess) {
        redirect("/orders");
    }

    return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
