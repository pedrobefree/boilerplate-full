"use client";
import { APIKeysPage } from "@/components/features/settings/APIKeysPage";
import { SettingsShell } from "@/components/features/settings/SettingsShell";

export default function Page() {
    return (
        <SettingsShell>
            <APIKeysPage />
        </SettingsShell>
    );
}
