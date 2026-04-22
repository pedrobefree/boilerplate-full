"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import type { ProjectItem } from "@/app/actions/dashboard";

interface ActiveProjectsCardProps {
    projects: ProjectItem[];
}

const STATUS_BADGE: Record<string, { variant: "brand" | "default" | "warning" | "success" | "error"; label: string }> = {
    active: { variant: "brand", label: "Ativo" },
    inactive: { variant: "default", label: "Inativo" },
    canceled: { variant: "error", label: "Cancelado" },
    archived: { variant: "warning", label: "Arquivado" },
};

export const ActiveProjectsCard = ({ projects }: ActiveProjectsCardProps) => {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Projetos Ativos</CardTitle>
                        <CardDescription>Iniciativas em andamento.</CardDescription>
                    </div>
                    <Link
                        href="/projects"
                        className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                    >
                        Ver todos
                    </Link>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {projects.length === 0 ? (
                    <div className="px-6 py-8 text-center text-gray-400 text-sm">
                        Nenhum projeto ativo no momento.
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {projects.map(project => {
                            const badge = STATUS_BADGE[project.status] ?? { variant: "default" as const, label: project.status };
                            return (
                                <Link
                                    key={project.id}
                                    href={`/projects/${project.slug}`}
                                    className="block p-4 hover:bg-gray-50/50 transition-colors space-y-3"
                                >
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-bold text-gray-900 truncate pr-2">{project.name}</p>
                                        <Badge variant={badge.variant} size="sm" className="shrink-0">
                                            {badge.label}
                                        </Badge>
                                    </div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-gray-500">
                                                {project.totalTasks > 0
                                                    ? `${project.totalTasks} tarefa${project.totalTasks !== 1 ? "s" : ""}`
                                                    : "Sem tarefas"}
                                            </span>
                                            <span className="font-bold text-gray-700">{project.progress}%</span>
                                        </div>
                                        <Progress value={project.progress} size="sm" variant="brand" />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
