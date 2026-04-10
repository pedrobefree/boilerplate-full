"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { withErrorHandling } from "@/lib/supabase/errors";
import { recordCurrentUserActivity } from "@/lib/activity-log";

export async function createTask(data: {
    projectId: string;
    title: string;
    description: string;
    status: 'todo' | 'in-progress' | 'done';
    priority: 'low' | 'medium' | 'high';
    dueDate?: string;
    assigneeId?: string;
}) {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { data: task, error } = await supabase
            .from("tasks")
            .insert({
                project_id: data.projectId,
                title: data.title,
                description: data.description,
                status: data.status,
                priority: data.priority,
                due_date: data.dueDate || null,
                assignee_id: data.assigneeId || null,
                created_by: user.id
            })
            .select()
            .single();

        if (error) throw error;

        if (task) {
            const { data: project } = await supabase
                .from("projects")
                .select("organization_id")
                .eq("id", task.project_id)
                .maybeSingle();

            await recordCurrentUserActivity({
                organizationId: project?.organization_id,
                action: "task_created",
                entityType: "tasks",
                entityId: task.id,
                metadata: {
                    projectId: task.project_id,
                    title: task.title,
                    status: task.status,
                    priority: task.priority,
                },
            });
        }

        revalidatePath(`/dashboard/projects/${data.projectId}`);
        // Also revalidate the generic projects page if we show task counts
        revalidatePath(`/dashboard/projects`);
        return task;
    }, { action: "createTask", projectId: data.projectId });
}

export async function updateTask(taskId: string, data: Partial<{
    title: string;
    description: string;
    status: 'todo' | 'in-progress' | 'done';
    priority: 'low' | 'medium' | 'high';
    dueDate: string;
    assigneeId: string;
}>) {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const { data: existingTask } = await supabase
            .from("tasks")
            .select("id, project_id, title, status")
            .eq("id", taskId)
            .maybeSingle();

        const updatePayload: any = { ...data };
        // Map camelCase to snake_case
        if (data.dueDate !== undefined) updatePayload.due_date = data.dueDate;
        if (data.assigneeId !== undefined) updatePayload.assignee_id = data.assigneeId;
        // Clean up unmapped props
        delete updatePayload.dueDate;
        delete updatePayload.assigneeId;

        updatePayload.updated_at = new Date().toISOString();

        const { data: task, error } = await supabase
            .from("tasks")
            .update(updatePayload)
            .eq("id", taskId)
            .select()
            .single();

        if (error) throw error;

        if (task && existingTask && data.status && existingTask.status !== data.status) {
            const { data: project } = await supabase
                .from("projects")
                .select("organization_id")
                .eq("id", task.project_id)
                .maybeSingle();

            await recordCurrentUserActivity({
                organizationId: project?.organization_id,
                action: "task_status_changed",
                entityType: "tasks",
                entityId: task.id,
                metadata: {
                    projectId: task.project_id,
                    title: task.title,
                    previousStatus: existingTask.status,
                    nextStatus: data.status,
                },
            });

            if (data.status === "done") {
                await recordCurrentUserActivity({
                    organizationId: project?.organization_id,
                    action: "task_completed",
                    entityType: "tasks",
                    entityId: task.id,
                    metadata: {
                        projectId: task.project_id,
                        title: task.title,
                    },
                });
            }
        }

        if (task) {
            revalidatePath(`/dashboard/projects/${task.project_id}`);
        }
        return task;
    }, { action: "updateTask", taskId });
}

export async function updateTaskStatus(taskId: string, status: 'todo' | 'in-progress' | 'done') {
    return updateTask(taskId, { status });
}

export async function deleteTask(taskId: string) {
    return withErrorHandling(async () => {
        const supabase = await createClient();

        // Get project ID first for revalidation
        const { data: task } = await supabase.from("tasks").select("project_id").eq("id", taskId).single();

        const { error } = await supabase
            .from("tasks")
            .delete()
            .eq("id", taskId);

        if (error) throw error;

        if (task) {
            revalidatePath(`/dashboard/projects/${task.project_id}`);
        }
        return true;
    }, { action: "deleteTask", taskId });
}

export async function getProjectTasks(projectId: string) {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const { data: tasks, error } = await supabase
            .from("tasks")
            .select(`
                *,
                notes:task_notes(count)
            `)
            .eq("project_id", projectId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Manually fetch assignee profiles
        const assigneeIds = Array.from(new Set(tasks?.map(t => t.assignee_id).filter(Boolean) || []));
        let profiles: any[] = [];

        if (assigneeIds.length > 0) {
            const { data: fetchedProfiles } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, email')
                .in('id', assigneeIds);
            profiles = fetchedProfiles || [];
        }

        const tasksWithAssignee = tasks?.map(t => ({
            ...t,
            assignee: t.assignee_id ? (profiles.find(p => p.id === t.assignee_id) || null) : null
        }));

        return tasksWithAssignee;
    }, { action: "getProjectTasks", projectId });
}
