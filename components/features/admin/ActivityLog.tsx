"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterSheet } from "@/components/ui/FilterSheet";

type ActivityRecord = {
    id: string;
    organization_id: string | null;
    actor_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    metadata: Record<string, any> | null;
    created_at: string;
    organization?: { name: string; slug: string } | { name: string; slug: string }[] | null;
    actor?: { id: string; full_name: string | null; email: string | null; avatar_url?: string | null } |
        { id: string; full_name: string | null; email: string | null; avatar_url?: string | null }[] | null;
};

type Option = {
    id: string;
    label: string;
};

type ActivityLogProps = {
    logs: ActivityRecord[];
    totalCount: number;
    page: number;
    totalPages: number;
    filters: {
        entityType: string;
        actorId: string;
        period: string;
        startDate: string;
        endDate: string;
        organizationId: string;
    };
    options: {
        actors: Option[];
        entityTypes: string[];
        organizations: { id: string; name: string }[];
        isSuperAdmin: boolean;
    };
};

const periodOptions = [
    { id: "all", label: "All time" },
    { id: "today", label: "Today" },
    { id: "7d", label: "Last 7 days" },
    { id: "30d", label: "Last 30 days" },
    { id: "custom", label: "Custom range" },
];

const actionLabels: Record<string, string> = {
    login: "User signed in",
    logout: "User signed out",
    organization_created: "Organization created",
    organization_updated: "Organization updated",
    organization_deleted: "Organization deleted",
    invitation_sent: "Invitation sent",
    invitation_accepted: "Invitation accepted",
    invitation_cancelled: "Invitation cancelled",
    member_role_changed: "Member role changed",
    member_removed: "Member removed",
    order_created: "Order created",
    order_status_changed: "Order status changed",
    order_cancelled: "Order cancelled",
    project_created: "Project created",
    project_updated: "Project updated",
    project_archived: "Project archived",
    task_created: "Task created",
    task_status_changed: "Task status changed",
    task_completed: "Task completed",
};

function normalizeRelation<T>(value: T | T[] | null | undefined) {
    return Array.isArray(value) ? value[0] : value ?? null;
}

function formatEntityType(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function describeTarget(log: ActivityRecord) {
    const metadata = log.metadata ?? {};

    if (log.entity_type === "projects") {
        return metadata.name || metadata.title || metadata.projectId || "Project";
    }

    if (log.entity_type === "tasks") {
        return metadata.title || metadata.projectId || "Task";
    }

    if (log.entity_type === "orders") {
        return log.entity_id ? `Order #${log.entity_id.slice(0, 8)}` : "Order";
    }

    if (log.entity_type === "members") {
        return metadata.email || metadata.userId || "Member";
    }

    if (log.entity_type === "invitations") {
        return metadata.email || "Invitation";
    }

    if (log.entity_type === "organizations") {
        return metadata.name || "Organization";
    }

    return metadata.label || log.entity_id || "Activity";
}

export const ActivityLog = ({ logs, totalCount, page, totalPages, filters, options }: ActivityLogProps) => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [actorId, setActorId] = useState(filters.actorId || "all");
    const [period, setPeriod] = useState(filters.period || "all");
    const [startDate, setStartDate] = useState(filters.startDate || "");
    const [endDate, setEndDate] = useState(filters.endDate || "");
    const [organizationId, setOrganizationId] = useState(filters.organizationId || "all");

    const updateFilters = (updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", "1");

        Object.entries(updates).forEach(([key, value]) => {
            if (value === null || value === "" || value === "all") {
                params.delete(key);
            } else {
                params.set(key, value);
            }
        });

        const nextQuery = params.toString();
        router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    };

    const clearFilters = () => {
        setActorId("all");
        setPeriod("all");
        setStartDate("");
        setEndDate("");
        setOrganizationId("all");
        router.push(pathname);
    };

    const hasActiveFilters = Boolean(
        filters.entityType ||
        filters.actorId ||
        filters.period ||
        filters.startDate ||
        filters.endDate ||
        filters.organizationId
    );

    const chips = useMemo(() => {
        const items: { key: string; label: string; onRemove: () => void }[] = [];
        const actor = options.actors.find((item) => item.id === filters.actorId);
        const organization = options.organizations.find((item) => item.id === filters.organizationId);
        const periodLabel = periodOptions.find((item) => item.id === filters.period)?.label;

        if (filters.entityType) {
            items.push({
                key: "entityType",
                label: `Type: ${formatEntityType(filters.entityType)}`,
                onRemove: () => updateFilters({ entityType: null }),
            });
        }

        if (actor) {
            items.push({
                key: "actorId",
                label: `Actor: ${actor.label}`,
                onRemove: () => {
                    setActorId("all");
                    updateFilters({ actorId: null });
                },
            });
        }

        if (periodLabel && filters.period) {
            items.push({
                key: "period",
                label: `Period: ${periodLabel}`,
                onRemove: () => {
                    setPeriod("all");
                    setStartDate("");
                    setEndDate("");
                    updateFilters({ period: null, startDate: null, endDate: null });
                },
            });
        }

        if (organization) {
            items.push({
                key: "organizationId",
                label: `Organization: ${organization.name}`,
                onRemove: () => {
                    setOrganizationId("all");
                    updateFilters({ organizationId: null });
                },
            });
        }

        return items;
    }, [filters.actorId, filters.entityType, filters.organizationId, filters.period, options.actors, options.organizations, updateFilters]);

    const columns = [
        {
            header: "Actor",
            cell: (log: ActivityRecord) => {
                const actor = normalizeRelation(log.actor);

                return (
                    <div className="flex items-center gap-3">
                        <Avatar
                            src={actor?.avatar_url || undefined}
                            alt={actor?.full_name || actor?.email || "System"}
                            size="sm"
                        />
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">
                                {actor?.full_name || actor?.email || "System"}
                            </p>
                            <p className="truncate text-xs text-gray-500">
                                {actor?.email || "Automated event"}
                            </p>
                        </div>
                    </div>
                );
            },
        },
        {
            header: "Event",
            cell: (log: ActivityRecord) => (
                <div className="py-1">
                    <p className="text-sm font-semibold text-gray-900">
                        {actionLabels[log.action] || log.action}
                    </p>
                    <p className="text-xs text-gray-500">
                        {describeTarget(log)}
                    </p>
                </div>
            ),
        },
        {
            header: "Type",
            cell: (log: ActivityRecord) => (
                <Badge size="sm" variant="brand">
                    {formatEntityType(log.entity_type)}
                </Badge>
            ),
        },
        {
            header: "Organization",
            cell: (log: ActivityRecord) => {
                const organization = normalizeRelation(log.organization);
                return (
                    <span className="text-sm text-gray-700">
                        {organization?.name || "No organization"}
                    </span>
                );
            },
            className: options.isSuperAdmin ? "" : "hidden",
        },
        {
            header: "Date",
            cell: (log: ActivityRecord) => (
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900">
                        {format(new Date(log.created_at), "MMM d, yyyy")}
                    </span>
                    <span className="text-xs text-gray-500">
                        {format(new Date(log.created_at), "HH:mm")}
                    </span>
                </div>
            ),
        },
    ].filter((column) => column.className !== "hidden");

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Activity Log</h1>
                    <p className="text-sm text-gray-500">
                        Monitor changes across organizations, members, orders, projects, and tasks.
                    </p>
                </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-1 flex-col gap-3 sm:flex-row">
                        <select
                            value={filters.entityType || "all"}
                            onChange={(event) => updateFilters({ entityType: event.target.value })}
                            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                            aria-label="Filter by event type"
                        >
                            <option value="all">All types</option>
                            {options.entityTypes.map((entityType) => (
                                <option key={entityType} value={entityType}>
                                    {formatEntityType(entityType)}
                                </option>
                            ))}
                        </select>

                        <FilterSheet
                            trigger={
                                <Button variant="secondary" className="gap-2 shrink-0">
                                    <Filter className="size-4" />
                                    More Filters
                                </Button>
                            }
                            onClearAll={clearFilters}
                            onApply={() =>
                                updateFilters({
                                    actorId,
                                    period,
                                    startDate: period === "custom" ? startDate : null,
                                    endDate: period === "custom" ? endDate : null,
                                    organizationId,
                                })
                            }
                        >
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label htmlFor="activity-actor-filter" className="text-sm font-medium text-gray-700">
                                        Actor
                                    </label>
                                    <select
                                        id="activity-actor-filter"
                                        value={actorId}
                                        onChange={(event) => setActorId(event.target.value)}
                                        className="h-11 w-full rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                                    >
                                        <option value="all">All actors</option>
                                        {options.actors.map((actor) => (
                                            <option key={actor.id} value={actor.id}>
                                                {actor.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="activity-period-filter" className="text-sm font-medium text-gray-700">
                                        Period
                                    </label>
                                    <select
                                        id="activity-period-filter"
                                        value={period}
                                        onChange={(event) => setPeriod(event.target.value)}
                                        className="h-11 w-full rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                                    >
                                        {periodOptions.map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {period === "custom" ? (
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <label className="space-y-2">
                                            <span className="text-sm font-medium text-gray-700">Start date</span>
                                            <input
                                                type="date"
                                                value={startDate}
                                                onChange={(event) => setStartDate(event.target.value)}
                                                className="h-11 w-full rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                                            />
                                        </label>
                                        <label className="space-y-2">
                                            <span className="text-sm font-medium text-gray-700">End date</span>
                                            <input
                                                type="date"
                                                value={endDate}
                                                onChange={(event) => setEndDate(event.target.value)}
                                                className="h-11 w-full rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                                            />
                                        </label>
                                    </div>
                                ) : null}

                                {options.isSuperAdmin ? (
                                    <div className="space-y-2">
                                        <label htmlFor="activity-organization-filter" className="text-sm font-medium text-gray-700">
                                            Organization
                                        </label>
                                        <select
                                            id="activity-organization-filter"
                                            value={organizationId}
                                            onChange={(event) => setOrganizationId(event.target.value)}
                                            className="h-11 w-full rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                                        >
                                            <option value="all">All organizations</option>
                                            {options.organizations.map((organization) => (
                                                <option key={organization.id} value={organization.id}>
                                                    {organization.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ) : null}
                            </div>
                        </FilterSheet>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <CalendarDays className="size-4" />
                        <span>{totalCount} event{totalCount === 1 ? "" : "s"}</span>
                    </div>
                </div>

                {hasActiveFilters ? (
                    <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 px-4 py-3">
                        {chips.map((chip) => (
                            <button
                                key={chip.key}
                                type="button"
                                onClick={chip.onRemove}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                            >
                                {chip.label}
                                <X className="size-3.5" />
                            </button>
                        ))}

                        <Button variant="tertiary" size="sm" onPress={clearFilters}>
                            Clear all
                        </Button>
                    </div>
                ) : null}

                <DataTable
                    data={logs}
                    columns={columns as any}
                    keyField="id"
                    page={page}
                    total={totalPages}
                    onPageChange={(nextPage) => {
                        const params = new URLSearchParams(searchParams.toString());
                        params.set("page", String(nextPage));
                        router.push(`${pathname}?${params.toString()}`);
                    }}
                    emptyState={
                        <div className="flex justify-center py-12">
                            <EmptyState size="md">
                                <EmptyState.Header>
                                    <EmptyState.Icon icon={Filter} size="md" color="gray" />
                                </EmptyState.Header>
                                <EmptyState.Content>
                                    <EmptyState.Title>No activity found</EmptyState.Title>
                                    <EmptyState.Description>
                                        Try adjusting your filters to see more events.
                                    </EmptyState.Description>
                                </EmptyState.Content>
                            </EmptyState>
                        </div>
                    }
                />
            </div>
        </div>
    );
};
