import { ActivityLog } from "@/components/features/admin/ActivityLog";
import { getActivityLogFilterOptions, getActivityLogs, getOrderActivityLogsForOrders } from "@/app/actions/activity-logs";

type PageProps = {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function getSingleParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

export default async function ActivityLogPage({ searchParams }: PageProps) {
    const resolvedParams = await searchParams;
    const page = Number(getSingleParam(resolvedParams.page) ?? "1");
    const entityType = getSingleParam(resolvedParams.entityType) ?? "";
    const actorId = getSingleParam(resolvedParams.actorId) ?? "";
    const period = getSingleParam(resolvedParams.period) ?? "";
    const startDate = getSingleParam(resolvedParams.startDate) ?? "";
    const endDate = getSingleParam(resolvedParams.endDate) ?? "";
    const organizationId = getSingleParam(resolvedParams.organizationId) ?? "";

    const [logsResponse, optionsResponse] = await Promise.all([
        getActivityLogs({
            page,
            limit: 20,
            entityType: entityType || undefined,
            actorId: actorId || undefined,
            period: (period as "today" | "7d" | "30d" | "custom") || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            organizationId: organizationId || undefined,
        }),
        getActivityLogFilterOptions(),
    ]);

    if (!logsResponse.success) {
        return <div className="p-6 text-red-500">Failed to load activity logs: {logsResponse.error}</div>;
    }

    if (!optionsResponse.success) {
        return <div className="p-6 text-red-500">Failed to load activity log filters: {optionsResponse.error}</div>;
    }

    const orderIds = Array.from(
        new Set(
            (logsResponse.data.logs as any[])
                .filter((log) => log.entity_type === "orders" && log.entity_id)
                .map((log) => log.entity_id as string)
        )
    );

    const orderHistoriesResponse = await getOrderActivityLogsForOrders(orderIds);
    const orderHistories = orderHistoriesResponse.success ? orderHistoriesResponse.data : {};
    const totalPages = Math.max(1, Math.ceil(logsResponse.data.count / 20));

    return (
        <ActivityLog
            logs={logsResponse.data.logs as any[]}
            orderHistories={orderHistories}
            totalCount={logsResponse.data.count}
            page={page}
            totalPages={totalPages}
            filters={{ entityType, actorId, period, startDate, endDate, organizationId }}
            options={optionsResponse.data}
        />
    );
}
