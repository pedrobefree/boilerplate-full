"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { withErrorHandling } from "@/lib/supabase/errors";
import { recordCurrentUserActivity } from "@/lib/activity-log";
import { slugify } from "@/lib/utils";
import { buildAppUrl, sendProjectAssignedEmail } from "@/lib/email";

async function syncProjectAssignments(params: {
    supabase: Awaited<ReturnType<typeof createClient>>;
    project: { id: string; slug: string; name: string; organization_id: string };
    actorId: string;
    ownerId?: string;
    memberIds?: string[];
}) {
    const desiredAssignments = new Map<string, string>();

    if (params.ownerId) {
        desiredAssignments.set(params.ownerId, "owner");
    }

    for (const memberId of params.memberIds || []) {
        if (!desiredAssignments.has(memberId)) {
            desiredAssignments.set(memberId, "member");
        }
    }

    if (desiredAssignments.size === 0) {
        return;
    }

    const { data: existingMembers } = await params.supabase
        .from("project_members")
        .select("user_id, role")
        .eq("project_id", params.project.id);

    const existingMap = new Map((existingMembers || []).map((member) => [member.user_id, member.role]));
    const upserts = Array.from(desiredAssignments.entries()).map(([userId, role]) => ({
        project_id: params.project.id,
        user_id: userId,
        role,
    }));

    const { error: upsertError } = await params.supabase
        .from("project_members")
        .upsert(upserts, { onConflict: "project_id,user_id" });

    if (upsertError) {
        throw upsertError;
    }

    const changedUserIds = Array.from(desiredAssignments.entries())
        .filter(([userId, role]) => existingMap.get(userId) !== role)
        .map(([userId]) => userId)
        .filter((userId) => userId !== params.actorId);

    if (changedUserIds.length === 0) {
        return;
    }

    const [{ data: profiles }, { data: organization }, { data: actorProfile }] = await Promise.all([
        params.supabase
            .from("profiles")
            .select("id, email, full_name")
            .in("id", changedUserIds),
        params.supabase
            .from("organizations")
            .select("name")
            .eq("id", params.project.organization_id)
            .maybeSingle(),
        params.supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", params.actorId)
            .maybeSingle(),
    ]);

    for (const profile of profiles || []) {
        if (!profile.email) {
            continue;
        }

        const roleLabel = desiredAssignments.get(profile.id) === "owner" ? "Responsável" : "Membro";

        await sendProjectAssignedEmail({
            to: profile.email,
            recipientName: profile.full_name,
            projectName: params.project.name,
            organizationName: organization?.name || "Organização",
            roleLabel,
            projectUrl: buildAppUrl(`/dashboard/projects/${params.project.slug}`),
            assignedByName: actorProfile?.full_name || actorProfile?.email || null,
        });
    }
}

export async function createProject(data: {
    organizationId: string;
    name: string;
    description?: string;
    keyObjective?: string;
    deadline?: string;
    isPrivate?: boolean;
    ownerId?: string;
    memberIds?: string[];
}) {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        // 1. Create Project
        const { data: project, error: createError } = await supabase
            .from("projects")
            .insert({
                organization_id: data.organizationId,
                name: data.name,
                slug: slugify(data.name),
                description: data.description,
                key_objective: data.keyObjective,
                deadline: data.deadline || null,
                is_private: data.isPrivate || false,
                status: 'active',
                created_by: user.id
            })
            .select()
            .single();

        if (createError) throw createError;

        // 2. Add creator as a member (owner role)
        const { error: memberError } = await supabase
            .from("project_members")
            .insert({
                project_id: project.id,
                user_id: user.id,
                role: 'owner'
            });

        if (memberError) {
            // Cleanup if member creation fails
            await supabase.from("projects").delete().eq("id", project.id);
            throw memberError;
        }

        await syncProjectAssignments({
            supabase,
            project,
            actorId: user.id,
            ownerId: data.ownerId,
            memberIds: data.memberIds,
        });

        await recordCurrentUserActivity({
            organizationId: project.organization_id,
            action: "project_created",
            entityType: "projects",
            entityId: project.id,
            metadata: {
                name: project.name,
                status: project.status,
            },
        });

        revalidatePath(`/dashboard/projects`);
        return project;
    }, { action: "createProject", name: data.name });
}

export async function updateProject(id: string, data: Partial<{
    name: string;
    description: string;
    keyObjective: string;
    status: string;
    deadline: string;
    isPrivate: boolean;
    ownerId: string;
    memberIds: string[];
}>) {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const { data: existingProject } = await supabase
            .from("projects")
            .select("id, organization_id, name, status")
            .eq("id", id)
            .maybeSingle();

        // Map camelCase to snake_case for DB
        const updatePayload: any = {};
        if (data.name !== undefined) {
            updatePayload.name = data.name;
            updatePayload.slug = slugify(data.name);
        }
        if (data.description !== undefined) updatePayload.description = data.description;
        if (data.keyObjective !== undefined) updatePayload.key_objective = data.keyObjective;
        if (data.status !== undefined) updatePayload.status = data.status;
        if (data.deadline !== undefined) updatePayload.deadline = data.deadline;
        if (data.isPrivate !== undefined) updatePayload.is_private = data.isPrivate;
        updatePayload.updated_at = new Date().toISOString();

        const { data: project, error } = await supabase
            .from("projects")
            .update(updatePayload)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;

        if (project) {
            const nextStatus = project.status;
            const previousStatus = existingProject?.status;
            const archivedStatuses = new Set(["inactive", "canceled", "archived"]);

            await recordCurrentUserActivity({
                organizationId: project.organization_id,
                action:
                    previousStatus !== nextStatus && archivedStatuses.has(nextStatus)
                        ? "project_archived"
                        : "project_updated",
                entityType: "projects",
                entityId: project.id,
                metadata: {
                    name: project.name,
                    previousStatus,
                    nextStatus,
                    updates: data,
                },
            });

            if (data.ownerId || data.memberIds) {
                const { data: authData } = await supabase.auth.getUser();

                if (authData.user) {
                    await syncProjectAssignments({
                        supabase,
                        project,
                        actorId: authData.user.id,
                        ownerId: data.ownerId,
                        memberIds: data.memberIds,
                    });
                }
            }
        }

        revalidatePath(`/dashboard/projects`);
        revalidatePath(`/dashboard/projects/${id}`);
        return project;
    }, { action: "updateProject", id });
}

export async function deleteProject(id: string) {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const { error } = await supabase
            .from("projects")
            .delete()
            .eq("id", id);

        if (error) throw error;
        revalidatePath(`/dashboard/projects`);
        return true;
    }, { action: "deleteProject", id });
}

export async function getProject(id: string) {
    return withErrorHandling(async () => {
        const supabase = await createClient();

        const { data: project, error } = await supabase
            .from("projects")
            .select(`
                *,
                tasks:tasks(count)
            `)
            .eq("id", id)
            .single();

        if (error) throw error;

        // Fetch members and their profiles using a separate query to avoid schema join issues
        const { data: rawMembers, error: membersError } = await supabase
            .from("project_members")
            .select("user_id, role")
            .eq("project_id", id);

        if (membersError) throw membersError;

        let projectMembers = [];
        if (rawMembers && rawMembers.length > 0) {
            const userIds = rawMembers.map(m => m.user_id);
            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, full_name, avatar_url, email")
                .in("id", userIds);

            projectMembers = rawMembers.map(m => ({
                ...m,
                profile: profiles?.find(p => p.id === m.user_id) || null
            }));
        }

        return { ...project, members: projectMembers };

        return { ...project, members: projectMembers };
    }, { action: "getProject", id });
}

export async function getProjectBySlug(slug: string) {
    return withErrorHandling(async () => {
        const supabase = await createClient();

        const { data: project, error } = await supabase
            .from("projects")
            .select(`
                *,
                tasks:tasks(count)
            `)
            .eq("slug", slug)
            .single();

        if (error) throw error;

        if (!project) return null;

        // Fetch task statuses for progress
        const { data: tasks } = await supabase
            .from("tasks")
            .select("status")
            .eq("project_id", project.id);

        const totalTasks = tasks?.length || 0;
        const doneTasks = tasks?.filter(t => t.status === 'done').length || 0;

        // Fetch members and their profiles using a separate query to avoid schema join issues
        const { data: rawMembers, error: membersError } = await supabase
            .from("project_members")
            .select("user_id, role")
            .eq("project_id", project.id);

        if (membersError) throw membersError;

        let projectMembers = [];
        if (rawMembers && rawMembers.length > 0) {
            const userIds = rawMembers.map(m => m.user_id);
            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, full_name, avatar_url, email")
                .in("id", userIds);

            projectMembers = rawMembers.map(m => ({
                ...m,
                profile: profiles?.find(p => p.id === m.user_id) || null
            }));
        }

        // Fetch upcoming tasks (first 3 incomplete)
        const { data: upcomingTasks } = await supabase
            .from("tasks")
            .select("*")
            .eq("project_id", project.id)
            .neq("status", "done")
            .order("due_date", { ascending: true })
            .limit(3);

        return { 
            ...project, 
            members: projectMembers,
            upcomingTasks: upcomingTasks || [],
            taskStats: {
                total: totalTasks,
                done: doneTasks,
                progress: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
            }
        };
    }, { action: "getProjectBySlug", slug });
}


export async function getMyProjects() {
    return withErrorHandling(async () => {
        const supabase = await createClient();

        // Check auth
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
            console.error("[getMyProjects] Auth error:", authError);
            throw authError;
        }

        const user = authData?.user;
        if (!user) {
            console.log("[getMyProjects] No authenticated user, returning empty array");
            return [];
        }

        console.log("[getMyProjects] User found:", user.id);

        // Fetch projects
        const { data: projects, error } = await supabase
            .from("projects")
            .select(`
                *,
                tasks:tasks(status)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("[getMyProjects] Projects query error:", error);
            throw error;
        }

        console.log("[getMyProjects] Found", projects?.length || 0, "projects");

        // Manually fetch creator profiles
        const creatorIds = Array.from(new Set(projects?.map(p => p.created_by).filter(Boolean) || []));
        let profiles: any[] = [];

        if (creatorIds.length > 0) {
            const { data: fetchedProfiles, error: profilesError } = await supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', creatorIds);

            if (profilesError) {
                console.error("[getMyProjects] Profiles query error:", profilesError);
            }
            profiles = fetchedProfiles || [];
        }

        const projectsWithStats = projects?.map(p => {
            const totalTasks = p.tasks?.length || 0;
            const doneTasks = p.tasks?.filter((t: any) => t.status === 'done').length || 0;
            const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
            
            return {
                ...p,
                creator: profiles.find(prof => prof.id === p.created_by) || { full_name: 'Unknown' },
                taskStats: {
                    total: totalTasks,
                    done: doneTasks,
                    progress
                }
            };
        });

        return projectsWithStats || [];
    }, { action: "getMyProjects" });
}

export async function addProjectMember(projectId: string, userId: string, role: string = 'member') {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const { error } = await supabase
            .from("project_members")
            .insert({
                project_id: projectId,
                user_id: userId,
                role
            });

        if (error) throw error;
        revalidatePath(`/dashboard/projects`);
        return { success: true };
    }, { action: "addProjectMember", projectId, userId });
}

export async function removeProjectMember(projectId: string, userId: string) {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const { error } = await supabase
            .from("project_members")
            .delete()
            .eq("project_id", projectId)
            .eq("user_id", userId);

        if (error) throw error;
        revalidatePath(`/dashboard/projects`);
        return { success: true };
    }, { action: "removeProjectMember", projectId, userId });
}
