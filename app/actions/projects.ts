"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { withErrorHandling } from "@/lib/supabase/errors";
import { recordCurrentUserActivity } from "@/lib/activity-log";

export async function createProject(data: {
    organizationId: string;
    name: string;
    description?: string;
    keyObjective?: string;
    deadline?: string;
    isPrivate?: boolean;
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
        if (data.name !== undefined) updatePayload.name = data.name;
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

        // Fetch members with profiles manually
        const { data: members, error: membersError } = await supabase
            .from("project_members")
            .select(`
                user_id,
                role,
                profile:profiles!user_id(full_name, avatar_url, email)
             `)
            .eq("project_id", id);

        // Note: project_members has (project_id, user_id). 
        // If profiles also references auth.users via id, we need to ensure the join works.
        // If project_members.user_id references auth.users, and profiles.id references auth.users, 
        // there is no DIRECT FK between project_members and profiles usually, UNLESS defined.
        // Safest is to manual fetch too if the above fails, but let's try the above first as it's a standard many-to-many.
        // UPDATE: To be safe given the previous error, let's manual fetch profiles for members too.

        let projectMembers = members || [];

        if (!members && !membersError) {
            // If embedding failed simply (which select shouldn't if syntax is right, but runtime might),
            // let's do manual.
            const { data: rawMembers } = await supabase
                .from("project_members")
                .select("user_id, role")
                .eq("project_id", id);

            if (rawMembers && rawMembers.length > 0) {
                const userIds = rawMembers.map(m => m.user_id);
                const { data: profiles } = await supabase.from("profiles").select("*").in("id", userIds);

                projectMembers = rawMembers.map(m => ({
                    ...m,
                    profile: profiles?.find(p => p.id === m.user_id)
                }));
            }
        }

        return { ...project, members: projectMembers };
    }, { action: "getProject", id });
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
                task_count:tasks(count)
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
                // Don't throw, just continue with empty profiles
            }
            profiles = fetchedProfiles || [];
        }

        const projectsWithCreator = projects?.map(p => ({
            ...p,
            creator: profiles.find(prof => prof.id === p.created_by) || { full_name: 'Unknown' }
        }));

        return projectsWithCreator || [];
    }, { action: "getMyProjects" });
}
