"use client";
import { SecuritySettingsPage } from "@/components/features/settings/SecuritySettingsPage";
import { SettingsShell } from "@/components/features/settings/SettingsShell";

export default function Page() {
    return (
        <SettingsShell>
            <SecuritySettingsPage />
        </SettingsShell>
    );
}
