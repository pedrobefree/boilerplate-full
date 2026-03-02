"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { withErrorHandling } from "@/lib/supabase/errors";

export async function createNote(taskId: string, content: string) {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { data: note, error } = await supabase
            .from("task_notes")
            .insert({
                task_id: taskId,
                user_id: user.id,
                note_body: content
            })
            .select()
            .single();

        if (error) throw error;

        // Fetch user profile
        const { data: userProfile } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
            .eq("id", user.id)
            .single();

        return { ...note, user: userProfile };
    }, { action: "createNote", taskId });
}

export async function getTaskNotes(taskId: string) {
    return withErrorHandling(async () => {
        const supabase = await createClient();
        const { data: notes, error } = await supabase
            .from("task_notes")
            .select('*')
            .eq("task_id", taskId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Fetch profiles
        const userIds = Array.from(new Set(notes?.map(n => n.user_id) || []));
        let profiles: any[] = [];
        if (userIds.length > 0) {
            const { data } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds);
            profiles = data || [];
        }

        const notesWithUser = notes?.map(n => ({
            ...n,
            user: profiles.find(p => p.id === n.user_id)
        }));

        return notesWithUser;
    }, { action: "getTaskNotes", taskId });
}
