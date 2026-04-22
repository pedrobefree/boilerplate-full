"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { PieChart } from "@/components/features/charts/PieChart";
import { chartColors } from "@/components/features/charts/charts-base";
import type { OrderStatusPoint } from "@/app/actions/dashboard";

interface OrderStatusChartProps {
    data: OrderStatusPoint[];
}

const STATUS_COLORS: Record<string, string> = {
    "Waiting for Payment": chartColors.warning,
    "Payment Approved": chartColors.blue,
    "Pending Delivery": chartColors.purple,
    "Completed": chartColors.success,
    "Canceled": chartColors.error,
};

const STATUS_LABELS: Record<string, string> = {
    "Waiting for Payment": "Aguardando",
    "Payment Approved": "Aprovado",
    "Pending Delivery": "Em entrega",
    "Completed": "Concluído",
    "Canceled": "Cancelado",
};

export function OrderStatusChart({ data }: OrderStatusChartProps) {
    const router = useRouter();

    const chartData = data.map(d => ({
        status: STATUS_LABELS[d.status] ?? d.status,
        count: d.count,
        originalStatus: d.status,
    }));

    const colors = data.map(d => STATUS_COLORS[d.status] ?? chartColors.gray);

    const handleSliceClick = (status: string) => {
        router.push(`/admin/orders?status=${encodeURIComponent(status)}`);
    };

    const hasData = data.length > 0;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Pedidos por Status</CardTitle>
                <CardDescription>Distribuição no período selecionado.</CardDescription>
            </CardHeader>
            <CardContent>
                {hasData ? (
                    <>
                        <PieChart
                            data={chartData}
                            category="count"
                            index="status"
                            colors={colors}
                            valueFormatter={(v: number | string) => `${v} pedido${Number(v) !== 1 ? "s" : ""}`}
                            height={220}
                            showLegend
                            variant="donut"
                        />
                        <div className="mt-3 space-y-1.5">
                            {data.map(d => (
                                <button
                                    key={d.status}
                                    onClick={() => handleSliceClick(d.status)}
                                    className="w-full flex items-center justify-between text-xs px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors group"
                                >
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="size-2 rounded-full shrink-0"
                                            style={{ backgroundColor: STATUS_COLORS[d.status] ?? chartColors.gray }}
                                        />
                                        <span className="text-gray-600 group-hover:text-gray-900 transition-colors">
                                            {STATUS_LABELS[d.status] ?? d.status}
                                        </span>
                                    </div>
                                    <span className="font-semibold text-gray-900">{d.count}</span>
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                        Nenhum pedido no período selecionado.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
