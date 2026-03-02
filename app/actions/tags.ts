"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type Tag = {
    id: string;
    name: string;
    description: string | null;
    color: string | null; // Hex code or predefined color name
    created_at: string;
};

export async function getTags(options?: { search?: string }) {
    const supabase = await createClient();
    let query = supabase.from("tags").select("*").order("name");

    if (options?.search) {
        query = query.ilike("name", `%${options.search}%`);
    }

    const { data, error } = await query;
    if (error) {
        console.error("Error fetching tags:", error);
        return [];
    }

    return data as Tag[];
}

export async function upsertTag(data: {
    id?: string;
    name: string;
    description?: string;
    color?: string;
}) {
    const supabase = await createClient();

    // RLS ensures only permitted users can write

    const { error } = await supabase
        .from("tags")
        .upsert({
            ...(data.id ? { id: data.id } : {}),
            name: data.name,
            description: data.description,
            color: data.color
        })
        .select();

    if (error) {
        return { error: error.message };
    }

    revalidatePath("/admin/catalog/tags");
    return { success: true };
}

export async function deleteTag(id: string) {
    const supabase = await createClient();
    const { error } = await supabase.from("tags").delete().eq("id", id);

    if (error) {
        return { error: error.message };
    }

    revalidatePath("/admin/catalog/tags");
    return { success: true };
}
