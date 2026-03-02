"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/utils";
import { useOrganization } from "@/app/context/OrganizationContext";
import { useIsSuperAdmin } from "@/hooks/use-admin";

export const SettingsShell = ({ children }: { children: ReactNode }) => {
    const pathname = usePathname();
    const { currentOrganization } = useOrganization();
    const { isAdmin: isSuperAdmin } = useIsSuperAdmin();

    const allTabs = [
        { id: "profile", label: "My Details", href: "/settings/profile" },
        { id: "organization", label: "Organization", href: "/settings/organization", restricted: true },
        { id: "notifications", label: "Notifications", href: "/settings/notifications" },
        { id: "security", label: "Security", href: "/settings/security" },
        { id: "api-keys", label: "API Keys", href: "/settings/api-keys" },
    ];

    const tabs = allTabs.filter(tab => {
        if (!tab.restricted) return true;
        // Show if super admin OR if org admin/owner
        return isSuperAdmin || (currentOrganization?.role && currentOrganization.role !== "member");
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-gray-500">Manage your account settings and preferences.</p>
            </div>

            <nav className="flex gap-4 border-b border-gray-200">
                {tabs.map((tab) => {
                    const isActive = pathname === tab.href || (pathname === "/settings" && tab.id === "profile");
                    return (
                        <Link
                            key={tab.id}
                            href={tab.href}
                            className={cx(
                                "px-1 pb-3 text-sm font-semibold transition-colors border-b-2 -mb-[2px]",
                                isActive
                                    ? "border-brand-600 text-brand-700"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            )}
                        >
                            {tab.label}
                        </Link>
                    )
                })}
            </nav>

            <div className="mt-6">
                {children}
            </div>
        </div>
    );
};
