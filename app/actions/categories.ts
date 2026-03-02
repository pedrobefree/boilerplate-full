"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type Category = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    image_url: string | null;
    parent_id: string | null;
    created_at: string;
    parent?: { name: string } | null;
};

export async function getCategories(options?: { search?: string }) {
    const supabase = await createClient();
    let query = supabase
        .from("categories")
        .select(`
            *,
            parent:parent_id (
                name
            )
        `)
        .order("name");

    if (options?.search) {
        query = query.ilike("name", `%${options.search}%`);
    }

    const { data, error } = await query;
    if (error) {
        console.error("Error fetching categories:", error);
        return [];
    }

    return data as Category[];
}

export async function upsertCategory(data: {
    id?: string;
    name: string;
    slug: string;
    description?: string;
    image_url?: string;
    parent_id?: string;
}) {
    const supabase = await createClient();

    // Check if user is super admin (handled by RLS, but double check or rely on RLS errors)
    // RLS "Admins write categories" using is_super_admin() is in place.

    const { error } = await supabase
        .from("categories")
        .upsert({
            id: data.id, // if undefined, it will create (but upsert usually needs Primary Key or On Conflict constraint)
            // upsert without ID usually implies logic to handle insert vs update. 
            // Better to separate or handle ID carefully.
            // Explicitly:
            ...(data.id ? { id: data.id } : {}),
            name: data.name,
            slug: data.slug,
            description: data.description,
            image_url: data.image_url,
            parent_id: data.parent_id === "none" ? null : data.parent_id
        })
        .select();

    if (error) {
        return { error: error.message };
    }

    revalidatePath("/admin/catalog/categories");
    return { success: true };
}

export async function deleteCategory(id: string) {
    const supabase = await createClient();
    const { error } = await supabase.from("categories").delete().eq("id", id);

    if (error) {
        return { error: error.message };
    }

    revalidatePath("/admin/catalog/categories");
    return { success: true };
}

export async function checkSlugAvailability(slug: string, currentId?: string) {
    const supabase = await createClient();
    let query = supabase.from("categories").select("id").eq("slug", slug);

    if (currentId) {
        query = query.neq("id", currentId);
    }

    const { data, error } = await query.single();
    // if data exists, slug is taken.
    return !data && (!error || error.code === 'PGRST116'); // PGRST116 is "No matching row found"
}
