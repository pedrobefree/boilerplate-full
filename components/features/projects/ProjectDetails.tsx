"use client";

import { ArrowLeft, Clock, Settings, Paperclip, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { AvatarGroupRoot as AvatarGroup } from "@/components/ui/AvatarGroup";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { AreaChart } from "../charts/AreaChart";


import { ProjectTasks } from "./ProjectTasks";
import { ProjectTeam } from "./ProjectTeam";
import { ProjectFiles } from "./ProjectFiles";
import { EditProjectModal } from "./EditProjectModal";
import { ProjectSharePopover } from "./ProjectSharePopover";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface ProjectDetailsProps {
    project: {
        id: string;
        name: string;
        description: string;
        status: string;
        progress: number;
        team: string[];
        category: string;
        taskStats?: {
            total: number;
            done: number;
            progress: number;
        };
    };
    onBack?: () => void;
}

export const ProjectDetails = ({ project: initialProject, onBack }: ProjectDetailsProps) => {
    const router = useRouter();
    const [selectedTab, setSelectedTab] = useState("overview");
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isSharePopoverOpen, setIsSharePopoverOpen] = useState(false);
    const [project, setProject] = useState(initialProject);
    const shareButtonRef = useRef<HTMLDivElement>(null);

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            router.push("/dashboard/projects");
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Header */}
            <div className="flex flex-col gap-6">
                <button
                    onClick={handleBack}
                    className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors group w-fit"
                >
                    <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform" />
                    Back to projects
                </button>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <h1 className="text-display-xs font-bold text-gray-900">{project.name}</h1>
                            <Badge variant={project.status === "active" ? "success" : "default"}>
                                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                            </Badge>
                        </div>
                        <p className="text-gray-500 max-w-2xl">{project.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div ref={shareButtonRef}>
                            <Button
                                variant="secondary"
                                onClick={() => setIsSharePopoverOpen(true)}
                            >
                                Share
                            </Button>
                        </div>
                        <Button
                            className="gap-2"
                            onClick={() => setIsEditModalOpen(true)}
                        >
                            <Settings className="size-4" /> Edit project
                        </Button>
                    </div>
                </div>
            </div>

            <Tabs
                selectedKey={selectedTab}
                onSelectionChange={(key) => setSelectedTab(key.toString())}
            >
                <Tabs.List type="underline">
                    <Tabs.Item id="overview">Overview</Tabs.Item>
                    <Tabs.Item id="tasks">Tasks</Tabs.Item>
                    <Tabs.Item id="team">Team members</Tabs.Item>
                </Tabs.List>

                <div className="mt-8">
                    <Tabs.Panel id="overview">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Main Content */}
                            <div className="lg:col-span-2 space-y-8">
                                { /* Hide Activity Graph per user request V1 */ }
                                { /* 
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Project Activity</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="h-[300px] pt-4">
                                            <AreaChart
                                                data={[
                                                    { date: "Jan 1", progress: 20 },
                                                    { date: "Jan 5", progress: 35 },
                                                    { date: "Jan 10", progress: 30 },
                                                    { date: "Jan 15", progress: 55 },
                                                    { date: "Jan 20", progress: 65 },
                                                    { date: "Jan 25", progress: 75 },
                                                ]}
                                                index="date"
                                                categories={["progress"]}
                                                valueFormatter={(v) => `${v}%`}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                                */ }

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <StatCard
                                        title="Active Tasks"
                                        value={project.taskStats?.total || "0"}
                                        subValue={`${project.taskStats?.done || 0} completed`}
                                        icon={CheckCircle2}
                                        iconClass="text-success-600 bg-success-50"
                                    />
                                    <StatCard
                                        title="Upcoming Deadlines"
                                        value="--"
                                        subValue="No immediate deadlines"
                                        icon={Clock}
                                        iconClass="text-warning-600 bg-warning-50"
                                    />
                                </div>

                                <Card>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <CardTitle className="text-lg">Upcoming Tasks</CardTitle>
                                            <Button
                                                variant="tertiary"
                                                size="sm"
                                                onClick={() => setSelectedTab("tasks")}
                                            >
                                                View all
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="divide-y divide-gray-100">
                                            {project.upcomingTasks && project.upcomingTasks.length > 0 ? (
                                                project.upcomingTasks.map((task: any) => (
                                                    <TaskRow 
                                                        key={task.id}
                                                        title={task.title} 
                                                        status={task.status.replace('_', ' ').charAt(0).toUpperCase() + task.status.slice(1)} 
                                                        priority={task.priority?.charAt(0).toUpperCase() + task.priority?.slice(1) || "Medium"} 
                                                    />
                                                ))
                                            ) : (
                                                <div className="py-8 text-center text-gray-500 text-sm">
                                                    No upcoming tasks for this project.
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Sidebar */}
                            <div className="space-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-sm uppercase tracking-wider text-gray-500">Project Progress</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex items-end justify-between">
                                            <span className="text-3xl font-bold text-gray-900">{project.taskStats?.progress || 0}%</span>
                                            <span className="text-sm text-gray-500">Target: 100%</span>
                                        </div>
                                        <Progress value={project.taskStats?.progress || 0} size="lg" />
                                        <p className="text-xs text-gray-500 leading-relaxed">
                                            {project.taskStats?.progress === 100 
                                                ? "Project fully completed based on tasks." 
                                                : "Progress based on tasks completion status."}
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-sm uppercase tracking-wider text-gray-500">Team</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-3">
                                            {project.members && project.members.slice(0, 3).map((m: any) => (
                                                <div key={m.user_id} className="flex items-center gap-3">
                                                    <Avatar src={m.profile?.avatar_url} alt={m.profile?.full_name} size="sm" />
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-sm font-semibold text-gray-900 truncate">{m.profile?.full_name}</span>
                                                        <span className="text-xs text-gray-500 truncate">{m.profile?.email}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {project.members && project.members.length > 3 && (
                                                <p className="text-xs text-gray-500 pl-11">
                                                    + {project.members.length - 3} more members
                                                </p>
                                            )}
                                            {(!project.members || project.members.length === 0) && (
                                                <p className="text-sm text-gray-500 italic">No members assigned</p>
                                            )}
                                        </div>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="w-full"
                                            onClick={() => setSelectedTab("team")}
                                        >
                                            Manage Team
                                        </Button>
                                    </CardContent>
                                </Card>

                            </div>
                        </div>
                    </Tabs.Panel>

                    <Tabs.Panel id="tasks">
                        <ProjectTasks projectId={project.id} />
                    </Tabs.Panel>

                    <Tabs.Panel id="team">
                        <ProjectTeam projectId={project.id} members={project.members} />
                    </Tabs.Panel>

                </div>
            </Tabs>

            <EditProjectModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                project={project}
                onSave={(data) => setProject({ ...project, ...data })}
            />

            <ProjectSharePopover
                triggerRef={shareButtonRef}
                isOpen={isSharePopoverOpen}
                onOpenChange={setIsSharePopoverOpen}
            />
        </div>
    );
};


const StatCard = ({ title, value, subValue, icon: Icon, iconClass }: any) => (
    <Card className="flex items-center gap-4 p-6">
        <div className={`p-3 rounded-lg ${iconClass}`}>
            <Icon className="size-6" />
        </div>
        <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{subValue}</p>
        </div>
    </Card>
);

const TaskRow = ({ title, status, priority }: any) => (
    <div className="py-4 grid grid-cols-[1fr_100px_80px] items-center gap-4 group cursor-pointer">
        <div className="flex items-center gap-3 min-w-0">
            <div className="size-5 shrink-0 rounded border border-gray-300 group-hover:border-brand-600 transition-colors" />
            <span className="text-sm font-medium text-gray-700 transition-colors group-hover:text-gray-900 truncate">{title}</span>
        </div>
        <div className="flex justify-start">
            <Badge variant="default" size="sm" className="bg-gray-50 text-gray-600 whitespace-nowrap">
                {priority}
            </Badge>
        </div>
        <div className="text-right">
            <span className="text-xs text-gray-500 whitespace-nowrap">{status}</span>
        </div>
    </div>
);

const AssetLink = ({ name, size }: any) => (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer group">
        <div className="flex items-center gap-2 overflow-hidden">
            <Paperclip className="size-4 text-gray-400 group-hover:text-brand-600" />
            <span className="text-sm text-gray-700 truncate">{name}</span>
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{size}</span>
    </div>
);
