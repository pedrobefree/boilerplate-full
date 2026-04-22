"use server";

import { createClient } from "@/lib/supabase/server";
import { withErrorHandling } from "@/lib/supabase/errors";
import { getActiveOrganizationId } from "./organization-context";

export type DashboardPeriod = "7d" | "30d" | "90d";

export type KpiMetrics = {
    totalOrders: number;
    totalOrdersPrev: number;
    totalRevenue: number;
    totalRevenuePrev: number;
    activeMembers: number;
    activeProjects: number;
    pendingTasks: number;
    inProgressTasks: number;
    doneTasks: number;
};

export type OrderPeriodPoint = {
    date: string;
    Pedidos: number;
    Receita: number;
};

export type OrderStatusPoint = {
    status: string;
    count: number;
};

export type ActivityItem = {
    id: string;
    action: string;
    entity_type: string;
    created_at: string;
    actor: {
        full_name: string | null;
        email: string | null;
        avatar_url: string | null;
    } | null;
};

export type ProjectItem = {
    id: string;
    name: string;
    slug: string;
    status: string;
    progress: number;
    totalTasks: number;
};

export type DashboardData = {
    kpis: KpiMetrics;
    ordersByPeriod: OrderPeriodPoint[];
    ordersByStatus: OrderStatusPoint[];
    recentActivity: ActivityItem[];
    activeProjectsList: ProjectItem[];
    userRole: string;
    period: DashboardPeriod;
};

function getPeriodBounds(period: DashboardPeriod) {
    const now = new Date();
    const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
    const msPerDay = 24 * 60 * 60 * 1000;
    const currentStart = new Date(now.getTime() - days * msPerDay);
    const prevStart = new Date(now.getTime() - days * 2 * msPerDay);
    return { now, currentStart, prevStart, days };
}

function formatDateLabel(date: Date) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}`;
}

function isSameDay(a: Date, b: Date) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

type RawOrder = { id: string; total_amount: number; status: string; created_at: string };

function buildOrdersPeriodChart(
    orders: RawOrder[],
    currentStart: Date,
    now: Date,
    period: DashboardPeriod
): OrderPeriodPoint[] {
    const msPerDay = 24 * 60 * 60 * 1000;

    if (period === "90d") {
        // Weekly buckets
        const points: OrderPeriodPoint[] = [];
        const cur = new Date(currentStart);
        cur.setDate(cur.getDate() - cur.getDay()); // align to week start

        while (cur <= now) {
            const weekStart = new Date(cur);
            const weekEnd = new Date(cur.getTime() + 7 * msPerDay);
            const label = formatDateLabel(weekStart);

            const weekOrders = orders.filter(o => {
                const d = new Date(o.created_at);
                return d >= weekStart && d < weekEnd && o.status !== "Canceled";
            });

            points.push({
                date: label,
                Pedidos: weekOrders.length,
                Receita: weekOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
            });

            cur.setDate(cur.getDate() + 7);
        }

        return points;
    }

    // Daily buckets for 7d and 30d
    const points: OrderPeriodPoint[] = [];
    const cur = new Date(currentStart);

    while (cur <= now) {
        const dayDate = new Date(cur);
        const label = formatDateLabel(dayDate);

        const dayOrders = orders.filter(o => {
            const d = new Date(o.created_at);
            return isSameDay(d, dayDate) && o.status !== "Canceled";
        });

        points.push({
            date: label,
            Pedidos: dayOrders.length,
            Receita: dayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
        });

        cur.setTime(cur.getTime() + msPerDay);
    }

    return points;
}

export async function getDashboardData(period: DashboardPeriod = "30d") {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const orgId = await getActiveOrganizationId();
        if (!orgId) throw new Error("No active organization");

        const { now, currentStart, prevStart } = getPeriodBounds(period);

        // Round 1: user role + all org project IDs (parallel)
        const [memberResult, allOrgProjectsResult] = await Promise.all([
            supabase
                .from("organization_members")
                .select("role")
                .eq("organization_id", orgId)
                .eq("user_id", user.id)
                .maybeSingle(),
            supabase
                .from("projects")
                .select("id")
                .eq("organization_id", orgId),
        ]);

        const userRole = memberResult.data?.role || "member";
        const allProjectIds = (allOrgProjectsResult.data || []).map((p: any) => p.id);

        // Round 2: all data queries in parallel
        const [ordersResult, membersResult, activeProjectsResult, activityResult, tasksResult] =
            await Promise.all([
                // Orders for double period (current + previous for KPI comparison)
                supabase
                    .from("orders")
                    .select("id, total_amount, status, created_at")
                    .eq("organization_id", orgId)
                    .gte("created_at", prevStart.toISOString()),

                // Members count
                supabase
                    .from("organization_members")
                    .select("user_id", { count: "exact", head: true })
                    .eq("organization_id", orgId),

                // Active projects with details (for widget, unfiltered for total count)
                supabase
                    .from("projects")
                    .select("id, name, slug, status")
                    .eq("organization_id", orgId)
                    .eq("status", "active")
                    .order("created_at", { ascending: false }),

                // Recent activity (last 10 events)
                supabase
                    .from("activity_logs")
                    .select(
                        `id, action, entity_type, created_at,
                        actor:profiles!activity_logs_actor_id_fkey(full_name, email, avatar_url)`
                    )
                    .order("created_at", { ascending: false })
                    .limit(10),

                // Tasks for all org projects
                allProjectIds.length > 0
                    ? supabase
                          .from("tasks")
                          .select("project_id, status")
                          .in("project_id", allProjectIds)
                    : Promise.resolve({ data: [] as { project_id: string; status: string }[] }),
            ]);

        // Process orders
        const allOrders = (ordersResult.data || []) as RawOrder[];
        const currentOrders = allOrders.filter(o => new Date(o.created_at) >= currentStart);
        const prevOrders = allOrders.filter(o => new Date(o.created_at) < currentStart);

        const nonCanceledCurrent = currentOrders.filter(o => o.status !== "Canceled");
        const nonCanceledPrev = prevOrders.filter(o => o.status !== "Canceled");

        const totalOrders = nonCanceledCurrent.length;
        const totalOrdersPrev = nonCanceledPrev.length;
        const totalRevenue = nonCanceledCurrent.reduce((sum, o) => sum + (o.total_amount || 0), 0);
        const totalRevenuePrev = nonCanceledPrev.reduce(
            (sum, o) => sum + (o.total_amount || 0),
            0
        );

        // Orders by status (current period)
        const statusMap = new Map<string, number>();
        for (const order of currentOrders) {
            statusMap.set(order.status, (statusMap.get(order.status) || 0) + 1);
        }
        const ordersByStatus: OrderStatusPoint[] = Array.from(statusMap.entries()).map(
            ([status, count]) => ({ status, count })
        );

        // Orders by period chart data
        const ordersByPeriod = buildOrdersPeriodChart(currentOrders, currentStart, now, period);

        // Task KPIs
        const tasksData = (tasksResult.data || []) as { project_id: string; status: string }[];
        const pendingTasks = tasksData.filter(t => t.status === "todo").length;
        const inProgressTasks = tasksData.filter(t => t.status === "in-progress").length;
        const doneTasks = tasksData.filter(t => t.status === "done").length;

        // Active projects count + widget list (first 5)
        const allActiveProjects = (activeProjectsResult.data || []) as Array<{
            id: string;
            name: string;
            slug: string | null;
            status: string;
        }>;
        const activeProjects = allActiveProjects.length;

        const activeProjectsList: ProjectItem[] = allActiveProjects.slice(0, 5).map(project => {
            const projectTasks = tasksData.filter(t => t.project_id === project.id);
            const total = projectTasks.length;
            const done = projectTasks.filter(t => t.status === "done").length;
            return {
                id: project.id,
                name: project.name,
                slug: project.slug || project.id,
                status: project.status,
                progress: total > 0 ? Math.round((done / total) * 100) : 0,
                totalTasks: total,
            };
        });

        // Recent activity
        const recentActivity: ActivityItem[] = (activityResult.data || []).map((item: any) => {
            const actor = Array.isArray(item.actor) ? item.actor[0] : item.actor;
            return {
                id: item.id,
                action: item.action,
                entity_type: item.entity_type,
                created_at: item.created_at,
                actor: actor || null,
            };
        });

        return {
            kpis: {
                totalOrders,
                totalOrdersPrev,
                totalRevenue,
                totalRevenuePrev,
                activeMembers: membersResult.count ?? 0,
                activeProjects,
                pendingTasks,
                inProgressTasks,
                doneTasks,
            },
            ordersByPeriod,
            ordersByStatus,
            recentActivity,
            activeProjectsList,
            userRole,
            period,
        } satisfies DashboardData;
    });
}
