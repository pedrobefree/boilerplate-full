"use client";
import { OrganizationSettingsPage } from "@/components/features/settings/OrganizationSettingsPage";
import { SettingsShell } from "@/components/features/settings/SettingsShell";

export default function Page() {
    return (
        <SettingsShell>
            <OrganizationSettingsPage />
        </SettingsShell>
    );
}
