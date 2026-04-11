"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Eye, Filter, History, X } from "lucide-react";
import { format } from "date-fns";
import { createPortal } from "react-dom";
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
    orderHistories: Record<string, ActivityRecord[]>;
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

function formatMetadataLabel(key: string) {
    return key
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMetadataValue(value: unknown): string {
    if (value === null || value === undefined) {
        return "N/A";
    }

    if (typeof value === "boolean") {
        return value ? "Yes" : "No";
    }

    if (typeof value === "number") {
        return String(value);
    }

    if (typeof value === "string") {
        return value;
    }

    return JSON.stringify(value, null, 2);
}

function formatCurrencyAmount(amount: number, currency: string) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency.toUpperCase(),
    }).format(amount / 100);
}

function formatMetadataEntryValue(
    key: string,
    value: unknown,
    context?: Record<string, unknown> | null
) {
    const normalizedKey = key.toLowerCase();
    const contextCurrency = typeof context?.currency === "string"
        ? context.currency
        : typeof context?.currency_code === "string"
            ? context.currency_code
            : typeof context?.currencyCode === "string"
                ? context.currencyCode
                : null;

    if (
        contextCurrency &&
        (
            normalizedKey === "total_amount" ||
            normalizedKey === "amount" ||
            normalizedKey === "unit_amount" ||
            normalizedKey.endsWith("_amount") ||
            normalizedKey.endsWith("amount")
        ) &&
        (typeof value === "number" || (typeof value === "string" && !Number.isNaN(Number(value))))
    ) {
        return formatCurrencyAmount(Number(value), contextCurrency);
    }

    return formatMetadataValue(value);
}

function MetadataValue({
    value,
    context,
    parentKey,
}: {
    value: unknown;
    context?: Record<string, unknown> | null;
    parentKey?: string;
}) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return (
            <div className="space-y-2">
                {Object.entries(value as Record<string, unknown>).map(([nestedKey, nestedValue]) => (
                    <div key={nestedKey} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                            {formatMetadataLabel(nestedKey)}
                        </p>
                        <div className="mt-1 text-xs text-gray-700">
                            <MetadataValue value={nestedValue} context={context ?? (value as Record<string, unknown>)} parentKey={nestedKey} />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (Array.isArray(value)) {
        return (
            <div className="space-y-1">
                {value.map((item, index) => (
                    <div key={index} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                        <MetadataValue value={item} context={context} parentKey={parentKey} />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <span className="break-words whitespace-pre-wrap">
            {parentKey ? formatMetadataEntryValue(parentKey, value, context) : formatMetadataValue(value)}
        </span>
    );
}

function HoverPanel({
    icon,
    label,
    children,
}: {
    icon: ReactNode;
    label: string;
    children: ReactNode;
}) {
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

    const updatePosition = () => {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;

        setPosition({
            top: rect.top - 12,
            left: Math.min(window.innerWidth - 336, Math.max(16, rect.right - 320)),
        });
    };

    useEffect(() => {
        if (!isOpen) return;

        updatePosition();
        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("resize", updatePosition);

        return () => {
            window.removeEventListener("scroll", updatePosition, true);
            window.removeEventListener("resize", updatePosition);
        };
    }, [isOpen]);

    return (
        <div
            className="relative"
            onMouseEnter={() => {
                updatePosition();
                setIsOpen(true);
            }}
            onMouseLeave={() => setIsOpen(false)}
        >
            <button
                ref={triggerRef}
                type="button"
                aria-label={label}
                className="inline-flex size-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:border-brand-200 hover:text-brand-600"
            >
                {icon}
            </button>
            {isOpen
                ? createPortal(
                    <div
                        className="pointer-events-none fixed z-[200] w-80 -translate-y-full rounded-xl border border-gray-200 bg-white p-4 shadow-2xl ring-1 ring-black/5"
                        style={{ top: position.top, left: position.left }}
                    >
                        {children}
                    </div>,
                    document.body
                )
                : null}
        </div>
    );
}

export const ActivityLog = ({ logs, orderHistories, totalCount, page, totalPages, filters, options }: ActivityLogProps) => {
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
        {
            header: "Details",
            className: "w-28 relative z-[70] overflow-visible",
            cell: (log: ActivityRecord) => {
                const metadata = log.metadata ?? {};
                const orderHistory = log.entity_id ? orderHistories[log.entity_id] ?? [] : [];

                return (
                    <div className="flex items-center justify-end gap-2">
                        <HoverPanel
                            icon={<Eye className="size-4" />}
                            label="View metadata"
                        >
                            <div className="space-y-3">
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">Metadata</p>
                                    <p className="text-xs text-gray-500">Structured event details</p>
                                </div>
                                {Object.keys(metadata).length > 0 ? (
                                    <div className="space-y-2">
                                        {Object.entries(metadata).map(([key, value]) => (
                                            <div key={key}>
                                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                                                    {formatMetadataLabel(key)}
                                                </p>
                                                <div className="text-xs text-gray-700">
                                                    {value && typeof value === "object" ? (
                                                        <MetadataValue value={value} context={metadata} parentKey={key} />
                                                    ) : (
                                                        <span className="break-words whitespace-pre-wrap">
                                                            {formatMetadataEntryValue(key, value, metadata)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-500">No metadata available for this event.</p>
                                )}
                            </div>
                        </HoverPanel>

                        {log.entity_type === "orders" && log.entity_id ? (
                            <HoverPanel
                                icon={<History className="size-4" />}
                                label="View order history"
                            >
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900">
                                            Order #{log.entity_id.slice(0, 8)}
                                        </p>
                                        <p className="text-xs text-gray-500">Grouped history for this order</p>
                                    </div>
                                    {orderHistory.length > 0 ? (
                                        <div className="space-y-3">
                                            {orderHistory.map((historyEvent) => (
                                                <div key={historyEvent.id} className="border-l-2 border-gray-200 pl-3">
                                                    <p className="text-xs font-semibold text-gray-900">
                                                        {actionLabels[historyEvent.action] || historyEvent.action}
                                                    </p>
                                                    <p className="text-[11px] text-gray-500">
                                                        {format(new Date(historyEvent.created_at), "MMM d, yyyy 'at' HH:mm")}
                                                    </p>
                                                    {historyEvent.metadata?.nextStatus ? (
                                                        <p className="mt-1 text-[11px] text-gray-600">
                                                            {historyEvent.metadata.previousStatus
                                                                ? `${historyEvent.metadata.previousStatus} -> ${historyEvent.metadata.nextStatus}`
                                                                : historyEvent.metadata.nextStatus}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500">No grouped history available.</p>
                                    )}
                                </div>
                            </HoverPanel>
                        ) : null}
                    </div>
                );
            },
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
