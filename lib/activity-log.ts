import { cookies } from "next/headers";
import { createClient, createSystemClient } from "@/lib/supabase/server";

const ACTIVE_ORG_COOKIE = "current_org_id";

export type ActivityEntityType =
    | "auth"
    | "organizations"
    | "invitations"
    | "members"
    | "orders"
    | "projects"
    | "tasks";

export type ActivityLogPayload = {
    organizationId?: string | null;
    actorId?: string | null;
    action: string;
    entityType: ActivityEntityType;
    entityId?: string | null;
    metadata?: Record<string, any>;
};

async function getActiveOrgId() {
    const cookieStore = await cookies();
    return cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null;
}

async function getCurrentUserId() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    return user?.id ?? null;
}

function sanitizeMetadata(metadata?: Record<string, any>) {
    if (!metadata) return {};

    return Object.fromEntries(
        Object.entries(metadata).filter(([, value]) => value !== undefined)
    );
}

export async function recordActivity(payload: ActivityLogPayload) {
    try {
        const supabase = createSystemClient();
        const organizationId = payload.organizationId ?? (await getActiveOrgId());

        const { error } = await supabase.from("activity_logs").insert({
            organization_id: organizationId,
            actor_id: payload.actorId ?? null,
            action: payload.action,
            entity_type: payload.entityType,
            entity_id: payload.entityId ?? null,
            metadata: sanitizeMetadata(payload.metadata),
        });

        if (error) {
            throw error;
        }

        return true;
    } catch (error) {
        console.error("[activity-log] Failed to record activity:", error);
        return false;
    }
}

export async function recordCurrentUserActivity(
    payload: Omit<ActivityLogPayload, "actorId" | "organizationId"> & {
        organizationId?: string | null;
    }
) {
    const actorId = await getCurrentUserId();

    return recordActivity({
        ...payload,
        actorId,
        organizationId: payload.organizationId,
    });
}
