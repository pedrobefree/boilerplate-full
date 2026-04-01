import { getOrders, OrderFilters } from "@/app/actions/orders";
import { OrdersList } from "./OrdersList";

export const dynamic = 'force-dynamic';

export default async function OrdersPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const resolvedParams = await searchParams;

    const filters: OrderFilters = {
        page: resolvedParams.page ? parseInt(resolvedParams.page as string, 10) : 1,
        limit: 10,
        status: (resolvedParams.status as string) || undefined,
        search: (resolvedParams.search as string) || undefined,
        productId: (resolvedParams.productId as string) || undefined,
        minValue: resolvedParams.minValue ? Number(resolvedParams.minValue) : undefined,
        maxValue: resolvedParams.maxValue ? Number(resolvedParams.maxValue) : undefined,
        startDate: (resolvedParams.startDate as string) || undefined,
        endDate: (resolvedParams.endDate as string) || undefined,
    };

    const { orders, count, error } = await getOrders(filters);

    if (error) {
        return <div className="p-6 text-red-500">Failed to load orders: {error}</div>;
    }

    return (
        <div>
            <OrdersList orders={orders} totalCount={count || 0} initialFilters={filters} />
        </div>
    );
}
