"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { withErrorHandling } from "@/lib/supabase/errors";
import { recordCurrentUserActivity } from "@/lib/activity-log";
import { slugify } from "@/lib/utils";
import { buildAppUrl, sendTaskAssignedEmail } from "@/lib/email";

async function notifyTaskAssignment(params: {
    supabase: Awaited<ReturnType<typeof createClient>>;
    taskId: string;
    projectId: string;
    assigneeId: string;
    title: string;
    status: string;
    dueDate?: string | null;
}) {
    const [projectResult, assigneeResult, authResult] = await Promise.all([
        params.supabase
            .from("projects")
            .select("name, slug")
            .eq("id", params.projectId)
            .maybeSingle(),
        params.supabase
            .from("profiles")
            .select("email, full_name")
            .eq("id", params.assigneeId)
            .maybeSingle(),
        params.supabase.auth.getUser(),
    ]);

    const project = projectResult.data;
    const assignee = assigneeResult.data;
    const actorId = authResult.data.user?.id;

    if (!project || !assignee?.email) {
        return;
    }

    let assignedByName: string | null = null;
    if (actorId) {
        const { data: actorProfile } = await params.supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", actorId)
            .maybeSingle();

        assignedByName = actorProfile?.full_name || actorProfile?.email || null;
    }

    await sendTaskAssignedEmail({
        to: assignee.email,
        recipientName: assignee.full_name,
        taskTitle: params.title,
        projectName: project.name,
        status: params.status,
        dueDate: params.dueDate,
        taskUrl: buildAppUrl(`/projects/${project.slug}?task=${params.taskId}`),
        assignedByName,
    });
}

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
                slug: slugify(data.title),
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

            if (task.assignee_id) {
                await notifyTaskAssignment({
                    supabase,
                    taskId: task.id,
                    projectId: task.project_id,
                    assigneeId: task.assignee_id,
                    title: task.title,
                    status: task.status,
                    dueDate: task.due_date,
                });
            }
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
            .select("id, project_id, title, status, assignee_id, due_date")
            .eq("id", taskId)
            .maybeSingle();

        const updatePayload: any = { ...data };
        // Handle title change -> slug change
        if (data.title !== undefined) updatePayload.slug = slugify(data.title);
        
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
            if (task.assignee_id && existingTask?.assignee_id !== task.assignee_id) {
                await notifyTaskAssignment({
                    supabase,
                    taskId: task.id,
                    projectId: task.project_id,
                    assigneeId: task.assignee_id,
                    title: task.title,
                    status: task.status,
                    dueDate: task.due_date,
                });
            }

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

export async function getAssignableMembers(projectId: string) {
    return withErrorHandling(async () => {
        const supabase = await createClient();

        // 1. Get project visibility and org ID
        const { data: project, error: projectError } = await supabase
            .from("projects")
            .select("organization_id, is_private")
            .eq("id", projectId)
            .single();

        if (projectError) throw projectError;

        if (project.is_private) {
            // Only project members
            const { data: members, error: membersError } = await supabase
                .from("project_members")
                .select(`
                    user_id,
                    profile:profiles!user_id(id, full_name, avatar_url, email)
                `)
                .eq("project_id", projectId);

            if (membersError) throw membersError;
            return members.map(m => m.profile);
        } else {
            // All organization members
            const { data: members, error: membersError } = await supabase
                .from("organization_members")
                .select(`
                    user_id,
                    profile:profiles!user_id(id, full_name, avatar_url, email)
                `)
                .eq("organization_id", project.organization_id);

            if (membersError) throw membersError;
            return members.map(m => m.profile);
        }
    }, { action: "getAssignableMembers", projectId });
}
