"use server";

import { createClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/supabase/errors";
import { recordCurrentUserActivity } from "@/lib/activity-log";

export type ActivityLogFilters = {
    page?: number;
    limit?: number;
    entityType?: string;
    actorId?: string;
    period?: "today" | "7d" | "30d" | "custom";
    startDate?: string;
    endDate?: string;
    organizationId?: string;
};

function buildDateRange(filters: ActivityLogFilters) {
    const now = new Date();

    if (filters.period === "today") {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return { start: start.toISOString(), end: undefined };
    }

    if (filters.period === "7d") {
        const start = new Date(now);
        start.setDate(start.getDate() - 7);
        return { start: start.toISOString(), end: undefined };
    }

    if (filters.period === "30d") {
        const start = new Date(now);
        start.setDate(start.getDate() - 30);
        return { start: start.toISOString(), end: undefined };
    }

    if (filters.period === "custom") {
        let end = filters.endDate;
        if (end) {
            const nextDay = new Date(end);
            nextDay.setDate(nextDay.getDate() + 1);
            end = nextDay.toISOString();
        }

        return {
            start: filters.startDate,
            end,
        };
    }

    return { start: undefined, end: undefined };
}

export async function getActivityLogs(filters: ActivityLogFilters = {}) {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            throw new Error("Unauthorized");
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        const isSuperAdmin = profile?.role === "super_admin";
        const page = filters.page ?? 1;
        const limit = filters.limit ?? 20;
        const from = (page - 1) * limit;
        const to = from + limit - 1;
        const dateRange = buildDateRange(filters);

        let query = supabase
            .from("activity_logs")
            .select(
                `
                id,
                organization_id,
                actor_id,
                action,
                entity_type,
                entity_id,
                metadata,
                created_at,
                organization:organizations(name, slug),
                actor:profiles!activity_logs_actor_id_fkey(id, full_name, email, avatar_url)
            `,
                { count: "exact" }
            )
            .order("created_at", { ascending: false })
            .range(from, to);

        if (filters.entityType && filters.entityType !== "all") {
            query = query.eq("entity_type", filters.entityType);
        }

        if (filters.actorId && filters.actorId !== "all") {
            query = query.eq("actor_id", filters.actorId);
        }

        if (filters.organizationId && filters.organizationId !== "all" && isSuperAdmin) {
            query = query.eq("organization_id", filters.organizationId);
        }

        if (dateRange.start) {
            query = query.gte("created_at", dateRange.start);
        }

        if (dateRange.end) {
            query = query.lt("created_at", dateRange.end);
        }

        const { data, error, count } = await query;
        if (error) throw error;

        return {
            logs: data ?? [],
            count: count ?? 0,
            isSuperAdmin,
        };
    });
}

export async function getActivityLogFilterOptions() {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            throw new Error("Unauthorized");
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        const isSuperAdmin = profile?.role === "super_admin";

        const [{ data: logs }, { data: organizations }] = await Promise.all([
            supabase
                .from("activity_logs")
                .select(`
                    actor_id,
                    actor:profiles!activity_logs_actor_id_fkey(id, full_name, email),
                    entity_type
                `)
                .order("created_at", { ascending: false })
                .limit(500),
            isSuperAdmin
                ? supabase.from("organizations").select("id, name").order("name")
                : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        ]);

        const actorMap = new Map<string, { id: string; label: string }>();
        const entityTypes = new Set<string>();

        for (const entry of logs ?? []) {
            if (entry.entity_type) {
                entityTypes.add(entry.entity_type);
            }

            const actor = Array.isArray(entry.actor) ? entry.actor[0] : entry.actor;
            if (entry.actor_id && actor) {
                actorMap.set(entry.actor_id, {
                    id: entry.actor_id,
                    label: actor.full_name || actor.email || "Unknown user",
                });
            }
        }

        return {
            actors: Array.from(actorMap.values()).sort((left, right) => left.label.localeCompare(right.label)),
            entityTypes: Array.from(entityTypes).sort(),
            organizations: organizations ?? [],
            isSuperAdmin,
        };
    });
}

export async function getOrderActivityLogs(orderId: string) {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            throw new Error("Unauthorized");
        }

        const { data, error } = await supabase
            .from("activity_logs")
            .select(`
                id,
                organization_id,
                actor_id,
                action,
                entity_type,
                entity_id,
                metadata,
                created_at,
                actor:profiles!activity_logs_actor_id_fkey(id, full_name, email, avatar_url)
            `)
            .eq("entity_type", "orders")
            .eq("entity_id", orderId)
            .order("created_at", { ascending: true });

        if (error) throw error;
        return data ?? [];
    });
}

export async function getOrderActivityLogsForOrders(orderIds: string[]) {
    return withErrorHandling(async () => {
        if (orderIds.length === 0) {
            return {} as Record<string, any[]>;
        }

        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            throw new Error("Unauthorized");
        }

        const { data, error } = await supabase
            .from("activity_logs")
            .select(`
                id,
                organization_id,
                actor_id,
                action,
                entity_type,
                entity_id,
                metadata,
                created_at,
                actor:profiles!activity_logs_actor_id_fkey(id, full_name, email, avatar_url)
            `)
            .eq("entity_type", "orders")
            .in("entity_id", orderIds)
            .order("created_at", { ascending: true });

        if (error) throw error;

        return (data ?? []).reduce<Record<string, any[]>>((accumulator, log) => {
            if (!log.entity_id) {
                return accumulator;
            }

            if (!accumulator[log.entity_id]) {
                accumulator[log.entity_id] = [];
            }

            accumulator[log.entity_id].push(log);
            return accumulator;
        }, {});
    });
}

export async function logAuthEvent(action: "login" | "logout") {
    return withErrorHandling(async () => {
        await recordCurrentUserActivity({
            action,
            entityType: "auth",
            entityId: action,
            metadata: {
                source: "auth",
            },
        });

        return { success: true };
    });
}
