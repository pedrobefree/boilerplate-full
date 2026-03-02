"use client";
import { NotificationsSettingsPage } from "@/components/features/settings/NotificationsSettingsPage";
import { SettingsShell } from "@/components/features/settings/SettingsShell";

export default function Page() {
    return (
        <SettingsShell>
            <NotificationsSettingsPage />
        </SettingsShell>
    );
}
