"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import type { ActivityItem } from "@/app/actions/dashboard";

interface RecentActivityCardProps {
    activities: ActivityItem[];
}

const ACTION_LABELS: Record<string, string> = {
    login: "Entrou na plataforma",
    logout: "Saiu da plataforma",
    organization_updated: "Atualizou a organização",
    invitation_sent: "Enviou um convite",
    invitation_accepted: "Aceitou um convite",
    invitation_cancelled: "Cancelou um convite",
    member_role_changed: "Alterou papel de membro",
    member_removed: "Removeu um membro",
    order_created: "Criou um pedido",
    order_status_changed: "Atualizou status do pedido",
    order_cancelled: "Cancelou um pedido",
    project_created: "Criou um projeto",
    project_updated: "Atualizou um projeto",
    project_archived: "Arquivou um projeto",
    task_created: "Criou uma tarefa",
    task_status_changed: "Atualizou status da tarefa",
    task_completed: "Concluiu uma tarefa",
};

function formatAction(action: string) {
    return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

function formatRelativeTime(dateStr: string) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60_000);
    if (mins < 1) return "agora";
    if (mins < 60) return `há ${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `há ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `há ${days}d`;
    return new Date(dateStr).toLocaleDateString("pt-BR");
}

function getInitials(name: string | null, email: string | null) {
    if (name) {
        const parts = name.trim().split(" ");
        if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
        return parts[0].slice(0, 2).toUpperCase();
    }
    return email ? email.slice(0, 2).toUpperCase() : "?";
}

export function RecentActivityCard({ activities }: RecentActivityCardProps) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">Atividade Recente</CardTitle>
                        <CardDescription>Últimas ações na organização.</CardDescription>
                    </div>
                    <Link
                        href="/admin/activity"
                        className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                    >
                        Ver tudo
                    </Link>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {activities.length === 0 ? (
                    <div className="px-6 py-8 text-center text-gray-400 text-sm">
                        Nenhuma atividade registrada.
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {activities.map(item => {
                            const actor = item.actor;
                            const initials = getInitials(actor?.full_name ?? null, actor?.email ?? null);
                            const displayName = actor?.full_name ?? actor?.email ?? "Sistema";

                            return (
                                <div key={item.id} className="flex items-start gap-3 px-6 py-3">
                                    <Avatar
                                        src={actor?.avatar_url ?? null}
                                        initials={initials}
                                        size="sm"
                                        className="shrink-0 mt-0.5"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-gray-900 leading-snug">
                                            <span className="font-medium">{displayName}</span>{" "}
                                            <span className="text-gray-500">{formatAction(item.action)}</span>
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {formatRelativeTime(item.created_at)}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
