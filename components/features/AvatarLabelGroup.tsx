
// import * as React from "react"
import { Avatar } from "@/components/ui/Avatar"

interface AvatarLabelGroupProps {
    src?: string
    title: string
    subtitle: string
    status?: "online" | "offline"
    size?: "sm" | "md" | "lg"
    fallback?: string
}

export function AvatarLabelGroup({ src, title, subtitle, status, size, fallback }: AvatarLabelGroupProps) {
    return (
        <div className="flex items-center gap-3">
            <Avatar src={src} size={size as any} status={status} initials={fallback} />
            <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-700">{title}</span>
                <span className="text-xs text-gray-500">{subtitle}</span>
            </div>
        </div>
    )
}
