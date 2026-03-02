"use client";
import ProfileSettingsPage from "@/components/features/settings/ProfileSettingsPage";
import { SettingsShell } from "@/components/features/settings/SettingsShell";

export default function Page() {
    return (
        <SettingsShell>
            <ProfileSettingsPage />
        </SettingsShell>
    );
}
