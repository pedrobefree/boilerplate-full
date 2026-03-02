"use client";

import { AppShell } from "@/components/layout/AppShell";
import { usePathname } from "next/navigation";
import { OrganizationProvider } from "@/app/context/OrganizationContext";

import { PendingInvitesModal } from "@/components/features/dashboard/PendingInvitesModal";

/**
 * Dashboard Layout
 * Wraps all dashboard pages in the sidebar and top navigation.
 */
export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    // Extract view name from pathname for AppShell's active state
    const currentView = pathname.split("/").pop() || "dashboard";

    return (
        <OrganizationProvider>
            <AppShell currentView={currentView}>
                {children}
            </AppShell>
            <PendingInvitesModal />
        </OrganizationProvider>
    );
}
