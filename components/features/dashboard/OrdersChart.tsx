"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { AreaChart } from "@/components/features/charts/AreaChart";
import { chartColors } from "@/components/features/charts/charts-base";
import type { OrderPeriodPoint, DashboardPeriod } from "@/app/actions/dashboard";
import { cn } from "@/lib/utils";

interface OrdersChartProps {
    data: OrderPeriodPoint[];
    period: DashboardPeriod;
}

const PERIOD_LABELS: Record<DashboardPeriod, string> = {
    "7d": "7 dias",
    "30d": "30 dias",
    "90d": "3 meses",
};

function formatRevenue(cents: number) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(cents / 100);
}

function formatRevenueShort(cents: number) {
    const value = cents / 100;
    if (value >= 1000) return `R$${(value / 1000).toFixed(0)}k`;
    return `R$${value.toFixed(0)}`;
}

export function OrdersChart({ data, period }: OrdersChartProps) {
    const router = useRouter();

    const handlePeriodChange = (newPeriod: DashboardPeriod) => {
        router.push(`/dashboard?period=${newPeriod}`);
    };

    const hasData = data.some(d => d.Pedidos > 0 || d.Receita > 0);

    return (
        <Card className="lg:col-span-2">
            <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <CardTitle>Pedidos por Período</CardTitle>
                        <CardDescription className="hidden sm:block">
                            Evolução de pedidos e receita ao longo do tempo.
                        </CardDescription>
                    </div>
                    <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-1 gap-1 self-start sm:self-auto">
                        {(["7d", "30d", "90d"] as DashboardPeriod[]).map(p => (
                            <button
                                key={p}
                                onClick={() => handlePeriodChange(p)}
                                className={cn(
                                    "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                                    period === p
                                        ? "bg-white text-gray-900 shadow-sm"
                                        : "text-gray-500 hover:text-gray-700"
                                )}
                            >
                                {PERIOD_LABELS[p]}
                            </button>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="h-[250px] sm:h-[300px]">
                {hasData ? (
                    <AreaChart
                        data={data}
                        categories={["Pedidos", "Receita"]}
                        index="date"
                        colors={[chartColors.brand, chartColors.success]}
                        valueFormatter={(value: number) => {
                            // Heuristic: if value looks like cents (> 100 per order), format as currency
                            return value > 100 ? formatRevenueShort(value) : String(value);
                        }}
                        height="100%"
                        showLegend
                        showGrid
                    />
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                        Nenhum pedido no período selecionado.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
