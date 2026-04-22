"use client";

import { LayoutGrid, Users, Plus, ShoppingCart, DollarSign, FolderOpen, ListTodo } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { MetricCard } from "@/components/ui/MetricCard";
import { useAuth } from "@/components/features/auth/AuthProvider";
import { ActiveProjectsCard } from "./ActiveProjectsCard";
import { RecentActivityCard } from "./RecentActivityCard";
import type { DashboardData, DashboardPeriod } from "@/app/actions/dashboard";

const OrdersChart = dynamic(
    () => import("./OrdersChart").then(mod => ({ default: mod.OrdersChart })),
    { ssr: false }
);

const OrderStatusChart = dynamic(
    () => import("./OrderStatusChart").then(mod => ({ default: mod.OrderStatusChart })),
    { ssr: false }
);

interface DashboardPageProps {
    dashboardData: DashboardData | null;
    period: DashboardPeriod;
}

function calcVariation(current: number, previous: number) {
    if (previous === 0) {
        return current > 0
            ? { value: "Novo", direction: "up" as const, label: "sem dados anteriores" }
            : null;
    }
    const pct = ((current - previous) / previous) * 100;
    return {
        value: `${pct >= 0 ? "+" : ""}${Math.abs(pct).toFixed(1)}%`,
        direction: (pct >= 0 ? "up" : "down") as "up" | "down",
        label: "vs período anterior",
    };
}

function formatRevenue(cents: number) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(cents / 100);
}

export function DashboardPage({ dashboardData, period }: DashboardPageProps) {
    const router = useRouter();
    const { user } = useAuth();
    const userName = user?.user_metadata?.full_name?.split(" ")[0] || "there";

    const kpis = dashboardData?.kpis;
    const isAdmin = dashboardData?.userRole === "owner" || dashboardData?.userRole === "admin";

    return (
        <div className="space-y-8 lg:space-y-12">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-2 border-b border-gray-100">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-brand-700 font-bold text-xs uppercase tracking-widest">
                        <LayoutGrid className="size-3.5" /> Workspace Overview
                    </div>
                    <h1 className="text-display-xs sm:text-display-sm font-bold text-gray-900 tracking-tight">
                        Olá, {userName}
                    </h1>
                    <p className="text-gray-500 text-base sm:text-lg">
                        Aqui está o que está acontecendo na sua organização.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="secondary"
                        onClick={() =>
                            window.dispatchEvent(
                                new CustomEvent("open-command-palette", { detail: { search: "Invite" } })
                            )
                        }
                        className="gap-2 flex-1 sm:flex-none"
                    >
                        <Users className="size-4" /> Time
                    </Button>
                    <Button
                        className="gap-2 shadow-lg shadow-brand-500/20 flex-1 sm:flex-none"
                        onClick={() =>
                            window.dispatchEvent(new CustomEvent("open-new-project-wizard"))
                        }
                    >
                        <Plus className="size-4" /> Novo Projeto
                    </Button>
                </div>
            </header>

            {/* KPI Cards */}
            <section className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {isAdmin && (
                    <>
                        <MetricCard
                            title="Total de Pedidos"
                            value={kpis ? String(kpis.totalOrders) : "—"}
                            trend={kpis ? (calcVariation(kpis.totalOrders, kpis.totalOrdersPrev) ?? undefined) : undefined}
                            icon={<ShoppingCart className="size-4" />}
                        />
                        <MetricCard
                            title="Receita"
                            value={kpis ? formatRevenue(kpis.totalRevenue) : "—"}
                            trend={kpis ? (calcVariation(kpis.totalRevenue, kpis.totalRevenuePrev) ?? undefined) : undefined}
                            icon={<DollarSign className="size-4" />}
                        />
                    </>
                )}
                <MetricCard
                    title="Projetos Ativos"
                    value={kpis ? String(kpis.activeProjects) : "—"}
                    icon={<FolderOpen className="size-4" />}
                    trend={
                        kpis
                            ? {
                                  value: String(kpis.inProgressTasks + kpis.pendingTasks),
                                  direction: "neutral",
                                  label: "tarefas pendentes",
                              }
                            : undefined
                    }
                />
                <MetricCard
                    title="Membros Ativos"
                    value={kpis ? String(kpis.activeMembers) : "—"}
                    icon={<Users className="size-4" />}
                    trend={
                        kpis
                            ? {
                                  value: String(kpis.doneTasks),
                                  direction: "up",
                                  label: "tarefas concluídas",
                              }
                            : undefined
                    }
                />
                {!isAdmin && (
                    <MetricCard
                        title="Tarefas em Andamento"
                        value={kpis ? String(kpis.inProgressTasks) : "—"}
                        icon={<ListTodo className="size-4" />}
                        trend={
                            kpis
                                ? {
                                      value: String(kpis.pendingTasks),
                                      direction: "neutral",
                                      label: "a fazer",
                                  }
                                : undefined
                        }
                    />
                )}
            </section>

            {/* Charts */}
            {isAdmin && (
                <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
                    <OrdersChart
                        data={dashboardData?.ordersByPeriod ?? []}
                        period={period}
                    />
                    <OrderStatusChart data={dashboardData?.ordersByStatus ?? []} />
                </div>
            )}

            {/* Projects + Activity widgets */}
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
                <ActiveProjectsCard projects={dashboardData?.activeProjectsList ?? []} />
                <RecentActivityCard activities={dashboardData?.recentActivity ?? []} />
            </div>

            {/* Tasks summary for members */}
            {kpis && (
                <div className="grid gap-4 sm:gap-6 sm:grid-cols-3">
                    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">A fazer</p>
                        <p className="text-3xl font-bold text-gray-900">{kpis.pendingTasks}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Em andamento</p>
                        <p className="text-3xl font-bold text-brand-600">{kpis.inProgressTasks}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Concluídas</p>
                        <p className="text-3xl font-bold text-success-600">{kpis.doneTasks}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
