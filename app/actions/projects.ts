"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { withErrorHandling } from "@/lib/supabase/errors";
import { recordCurrentUserActivity } from "@/lib/activity-log";
import { slugify } from "@/lib/utils";
import { buildAppUrl, sendProjectAssignedEmail } from "@/lib/email";

const ELIGIBLE_ORGANIZATION_ROLES = ["owner", "admin", "member"] as const;
const UPCOMING_DEADLINE_WINDOW_DAYS = 7;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function parseProjectDate(dateValue: string | null | undefined) {
    if (!dateValue) {
        return null;
    }

    const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const [, year, month, day] = match;
        return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
    }

    const parsed = new Date(dateValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isUpcomingDeadline(dateValue: string | null | undefined, now: Date) {
    const dueDate = parseProjectDate(dateValue);
    if (!dueDate) {
        return false;
    }

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = dueDate.getTime() - startOfToday.getTime();
    return diff >= 0 && diff <= UPCOMING_DEADLINE_WINDOW_DAYS * DAY_IN_MS;
}

async function assertEligibleOrganizationUsers(params: {
    supabase: Awaited<ReturnType<typeof createClient>>;
    organizationId: string;
    userIds: string[];
}) {
    const uniqueUserIds = Array.from(new Set(params.userIds.filter(Boolean)));

    if (uniqueUserIds.length === 0) {
        return;
    }

    const { data, error } = await params.supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", params.organizationId)
        .in("user_id", uniqueUserIds)
        .in("role", [...ELIGIBLE_ORGANIZATION_ROLES]);

    if (error) {
        throw error;
    }

    const eligibleIds = new Set((data || []).map((member) => member.user_id));
    const invalidIds = uniqueUserIds.filter((userId) => !eligibleIds.has(userId));

    if (invalidIds.length > 0) {
        throw new Error("Only organization owners, admins, or members can be associated with this project.");
    }
}

async function getProjectMembersWithProfiles(
    supabase: Awaited<ReturnType<typeof createClient>>,
    projectId: string
) {
    const { data: rawMembers, error: membersError } = await supabase
        .from("project_members")
        .select("user_id, role")
        .eq("project_id", projectId);

    if (membersError) {
        throw membersError;
    }

    if (!rawMembers || rawMembers.length === 0) {
        return [];
    }

    const userIds = rawMembers.map((member) => member.user_id);
    const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, email")
        .in("id", userIds);

    if (profilesError) {
        throw profilesError;
    }

    return rawMembers.map((member) => ({
        ...member,
        profile: profiles?.find((profile) => profile.id === member.user_id) || null,
    }));
}

async function buildProjectSnapshot(
    supabase: Awaited<ReturnType<typeof createClient>>,
    project: any
) {
    const [tasksResult, membersResult] = await Promise.all([
        supabase
            .from("tasks")
            .select("id, title, status, priority, due_date, assignee_id")
            .eq("project_id", project.id)
            .order("due_date", { ascending: true, nullsFirst: false }),
        getProjectMembersWithProfiles(supabase, project.id),
    ]);

    if (tasksResult.error) {
        throw tasksResult.error;
    }

    const tasks = tasksResult.data || [];
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((task) => task.status === "done").length;
    const openTasksWithDeadlines = tasks
        .filter((task) => task.status !== "done" && task.due_date)
        .sort((a, b) => {
            const aTime = parseProjectDate(a.due_date)?.getTime() || Number.MAX_SAFE_INTEGER;
            const bTime = parseProjectDate(b.due_date)?.getTime() || Number.MAX_SAFE_INTEGER;
            return aTime - bTime;
        });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const futureOpenTasksWithDeadlines = openTasksWithDeadlines.filter((task) => {
        const parsed = parseProjectDate(task.due_date);
        return parsed ? parsed.getTime() >= startOfToday.getTime() : false;
    });
    const upcomingDeadlineTasks = openTasksWithDeadlines.filter((task) => isUpcomingDeadline(task.due_date, now));
    const upcomingTasks = (upcomingDeadlineTasks.length > 0 ? upcomingDeadlineTasks : futureOpenTasksWithDeadlines).slice(0, 5);

    return {
        ...project,
        members: membersResult,
        upcomingTasks,
        upcomingDeadlines: {
            count: upcomingDeadlineTasks.length,
            nearestDueDate: futureOpenTasksWithDeadlines[0]?.due_date || null,
        },
        taskStats: {
            total: totalTasks,
            done: doneTasks,
            progress: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
        },
    };
}

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

    await assertEligibleOrganizationUsers({
        supabase: params.supabase,
        organizationId: params.project.organization_id,
        userIds: Array.from(desiredAssignments.keys()),
    });

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
        return buildProjectSnapshot(supabase, project);
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
        return buildProjectSnapshot(supabase, project);
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
        const { data: project, error: projectError } = await supabase
            .from("projects")
            .select("id, organization_id, slug")
            .eq("id", projectId)
            .maybeSingle();

        if (projectError) throw projectError;
        if (!project) throw new Error("Project not found.");

        await assertEligibleOrganizationUsers({
            supabase,
            organizationId: project.organization_id,
            userIds: [userId],
        });

        const { error } = await supabase
            .from("project_members")
            .insert({
                project_id: projectId,
                user_id: userId,
                role
            });

        if (error) throw error;
        revalidatePath(`/dashboard/projects`);
        revalidatePath(`/dashboard/projects/${project.slug}`);
        return { success: true };
    }, { action: "addProjectMember", projectId, userId });
}

export async function removeProjectMember(projectId: string, userId: string) {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const { data: project } = await supabase
            .from("projects")
            .select("slug")
            .eq("id", projectId)
            .maybeSingle();

        const { error } = await supabase
            .from("project_members")
            .delete()
            .eq("project_id", projectId)
            .eq("user_id", userId);

        if (error) throw error;
        revalidatePath(`/dashboard/projects`);
        if (project?.slug) {
            revalidatePath(`/dashboard/projects/${project.slug}`);
        }
        return { success: true };
    }, { action: "removeProjectMember", projectId, userId });
}
