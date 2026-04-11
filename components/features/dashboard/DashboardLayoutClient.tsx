"use client";

import { AppShell } from "@/components/layout/AppShell";
import { usePathname } from "next/navigation";
import { OrganizationProvider } from "@/app/context/OrganizationContext";
import { ProtectedRoute } from "@/components/features/auth/ProtectedRoute";
import { PendingInvitesModal } from "@/components/features/dashboard/PendingInvitesModal";

export default function DashboardLayoutClient({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const currentView = pathname.split("/").pop() || "dashboard";

    return (
        <ProtectedRoute>
            <OrganizationProvider>
                <AppShell currentView={currentView}>
                    {children}
                </AppShell>
                <PendingInvitesModal />
            </OrganizationProvider>
        </ProtectedRoute>
    );
}
