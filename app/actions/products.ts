"use server";

import { createClient, createSystemClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { isAdminOrOwner } from "@/app/actions/auth-helpers";

export type ProductWithDetails = {
    id: string;
    name: string;
    description: string | null;
    active: boolean | null;
    image: string | null;
    category_id: string | null;
    featured_image_index: number;
    metadata: any;
    prices?: any[];
    category?: { id: string; name: string; slug: string } | null;
    tags?: { tag_id: string, tags: { id: string; name: string; color: string } }[];
    images?: { url: string, display_order: number }[];
};

export type ProductSort = "relevance" | "name-asc" | "name-desc" | "price-asc" | "price-desc";

export async function getProducts(options?: {
    search?: string;
    categorySlug?: string;
    tagId?: string;
    sort?: ProductSort;
}) {
    const supabase = await createClient();
    const search = options?.search?.trim();
    const sort = options?.sort ?? "relevance";
    let productIdsForTag: string[] | null = null;

    if (options?.tagId) {
        const { data: taggedProducts, error: taggedProductsError } = await supabase
            .from("product_tags")
            .select("product_id")
            .eq("tag_id", options.tagId);

        if (taggedProductsError) {
            console.error("Error fetching tagged products:", taggedProductsError);
            return [];
        }

        productIdsForTag = (taggedProducts ?? []).map((entry) => entry.product_id);
        if (productIdsForTag.length === 0) {
            return [];
        }
    }

    let categoryId: string | null = null;
    if (options?.categorySlug) {
        const { data: category, error: categoryError } = await supabase
            .from("categories")
            .select("id")
            .eq("slug", options.categorySlug)
            .maybeSingle();

        if (categoryError) {
            console.error("Error fetching category for product filters:", categoryError);
            return [];
        }

        if (!category) {
            return [];
        }

        categoryId = category.id;
    }

    let query = supabase
        .from("products")
        .select(`
            *,
            category:category_id (id, name, slug),
            prices (*),
            tags:product_tags (
                tag_id,
                tags (id, name, color)
            )
        `)
        .eq("active", true);

    if (search) {
        query = query.ilike("name", `%${search}%`);
    }

    if (categoryId) {
        query = query.eq("category_id", categoryId);
    }

    if (productIdsForTag) {
        query = query.in("id", productIdsForTag);
    }

    if (sort === "name-desc") {
        query = query.order("name", { ascending: false });
    } else {
        query = query.order("name", { ascending: true });
    }

    const { data, error } = await query;
    if (error) {
        console.error("Error fetching products:", error);
        return [];
    }

    const products = (data ?? []) as ProductWithDetails[];

    if (sort === "price-asc" || sort === "price-desc") {
        const direction = sort === "price-asc" ? 1 : -1;

        products.sort((left, right) => {
            const leftPrice = left.prices?.find((price) => price.active)?.unit_amount ?? left.prices?.[0]?.unit_amount ?? Number.POSITIVE_INFINITY;
            const rightPrice = right.prices?.find((price) => price.active)?.unit_amount ?? right.prices?.[0]?.unit_amount ?? Number.POSITIVE_INFINITY;

            if (leftPrice === rightPrice) {
                return left.name.localeCompare(right.name);
            }

            return (leftPrice - rightPrice) * direction;
        });
    }

    return products;
}

export async function getProduct(id: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("products")
        .select(`
            *,
            category:category_id (name),
            prices (*),
            images:product_images (url, display_order),
            tags:product_tags (tag_id)
        `)
        .eq("id", id)
        .single();

    if (error) {
        console.error("getProduct error:", error);
        return null;
    }
    console.log("getProduct success for id:", id);
    return data;
}

export type ProductFormValues = {
    id?: string;
    name: string;
    description?: string;
    active: boolean;
    category_id?: string;
    featured_image_index: number;
    images: string[]; // List of URLs
    tag_ids: string[];
    price?: {
        amount: number;
        currency: string;
        interval?: "day" | "week" | "month" | "year";
        interval_count?: number;
        trial_period_days?: number;
        type: "one_time" | "recurring";
    }
};

export async function upsertProduct(data: ProductFormValues) {
    // Check authorization
    const isAllowed = await isAdminOrOwner();
    if (!isAllowed) {
        return { error: "Unauthorized: You must be an admin or owner to manage products." };
    }

    // Use System Client to bypass RLS for Prices table
    const supabase = createSystemClient();

    try {
        let productId = data.id;
        let stripePriceId = null;

        // 1. Generate a user-friendly ID for new products (slug format: prod_snake_case_name)
        if (!productId) {
            const baseSlug = data.name
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
                .replace(/\s+/g, '_')          // Replace spaces with underscores
                .replace(/_+/g, '_')           // Replace multiple underscores with single
                .slice(0, 40);                 // Limit length
            productId = `prod_${baseSlug}`;

            // Check for uniqueness and append suffix if needed
            const { data: existingProduct } = await supabase
                .from("products")
                .select("id")
                .eq("id", productId)
                .maybeSingle();

            if (existingProduct) {
                // Append a short random suffix
                const suffix = Math.random().toString(36).substring(2, 6);
                productId = `prod_${baseSlug}_${suffix}`;
            }
        }

        // 2. Sync Product to Supabase FIRST (to prevent orphan Stripe products on failure)
        const { error: productError } = await supabase.from("products").upsert({
            id: productId,
            name: data.name,
            description: data.description,
            active: data.active,
            category_id: data.category_id || null,
            featured_image_index: data.featured_image_index,
            image: data.images[data.featured_image_index || 0] || null
        });

        if (productError) throw productError;

        // 3. Stripe Product (Create/Update AFTER Supabase succeeds)
        const productPayload: Stripe.ProductCreateParams = {
            name: data.name,
            description: data.description,
            active: data.active,
            images: data.images.slice(0, 8), // Stripe limit 8
            metadata: {
                category_id: data.category_id || null
            }
        };

        if (data.id) {
            // Updating existing product
            await stripe.products.update(productId, productPayload);
        } else {
            // Creating new product with our custom ID
            await stripe.products.create({
                ...productPayload,
                id: productId
            });
        }


        // 2. Stripe Price (Only create new if provided, logic to update is complex)
        // Check if we need to create a price
        // 2. Stripe Price
        if (data.price) {
            // Check if there's an existing active price that matches perfectly
            const { data: existingPrices } = await supabase
                .from("prices")
                .select("*")
                .eq("product_id", productId)
                .eq("active", true)
                .eq("currency", data.price.currency)
                .eq("unit_amount", Math.round(data.price.amount * 100))
                .eq("type", data.price.type);

            let matchingPrice = null;

            if (existingPrices && existingPrices.length > 0) {
                matchingPrice = existingPrices.find(p => {
                    if (data.price?.type === 'recurring') {
                        return p.interval === data.price.interval;
                    }
                    return true;
                });
            }

            if (matchingPrice) {
                console.log("Found matching existing price, reusing:", matchingPrice.id);
                stripePriceId = matchingPrice.id;
            } else {
                console.log("No matching price found, creating new one.");
                // Create new price in Stripe
                const pricePayload: Stripe.PriceCreateParams = {
                    product: productId,
                    currency: data.price.currency,
                    unit_amount: Math.round(data.price.amount * 100), // Stripe expects cents
                    nickname: data.name + (data.price.interval ? ` (${data.price.interval})` : ""),
                    metadata: {
                        is_main: "true",
                        product_id: productId,
                        stripe_product_id: productId
                    }
                };

                if (data.price.type === 'recurring' && data.price.interval) {
                    pricePayload.recurring = {
                        interval: data.price.interval,
                        interval_count: data.price.interval_count || 1,
                        trial_period_days: data.price.trial_period_days || undefined
                    };
                }

                const newPrice = await stripe.prices.create(pricePayload);
                stripePriceId = newPrice.id;

                // Sync Price to Supabase immediately
                const { error: insertError } = await supabase.from("prices").insert({
                    id: newPrice.id,
                    product_id: productId,
                    active: newPrice.active,
                    currency: newPrice.currency,
                    type: newPrice.type,
                    unit_amount: newPrice.unit_amount,
                    interval: newPrice.recurring?.interval,
                    interval_count: newPrice.recurring?.interval_count,
                    trial_period_days: newPrice.recurring?.trial_period_days,
                    description: newPrice.nickname || null,
                    metadata: newPrice.metadata
                });

                if (insertError) {
                    console.error("Error inserting new price into Supabase:", insertError);
                    throw insertError;
                }
                console.log("Inserted new active price into Supabase:", newPrice.id);
            }
        }

        // Deactivate other prices to ensure only one main price is active (Prevent duplicate active prices)
        if (stripePriceId) {
            const { data: otherActivePrices } = await supabase
                .from("prices")
                .select("id")
                .eq("product_id", productId)
                .eq("active", true)
                .neq("id", stripePriceId);

            if (otherActivePrices && otherActivePrices.length > 0) {
                console.log(`Deactivating ${otherActivePrices.length} old prices for product ${productId}`);
                // Use Promise.all to handle updates in parallel, preventing one failure from blocking others
                await Promise.all(otherActivePrices.map(async (p) => {
                    // 1. Try to archive in Stripe
                    try {
                        await stripe.prices.update(p.id, { active: false });
                    } catch (err: any) {
                        console.warn(`Failed to archive price ${p.id} in Stripe (might be used in subscriptions):`, err.message);
                        // Continue to update Supabase even if Stripe fails, to keep UI consistent
                    }

                    // 2. Archive in Supabase
                    try {
                        const { error: dbError } = await supabase.from("prices").update({ active: false }).eq("id", p.id);
                        if (dbError) throw dbError;
                    } catch (err) {
                        console.error(`Failed to separate Supabase price ${p.id} deactivation:`, err);
                    }
                }));
            }
        }



        // 4. Product Images
        // Delete existing and re-insert
        await supabase.from("product_images").delete().eq("product_id", productId);
        if (data.images.length > 0) {
            const imageInserts = data.images.map((url, idx) => ({
                product_id: productId,
                url: url,
                display_order: idx
            }));
            await supabase.from("product_images").insert(imageInserts);
        }

        // 5. Product Tags
        await supabase.from("product_tags").delete().eq("product_id", productId);
        if (data.tag_ids.length > 0) {
            const tagInserts = data.tag_ids.map(tagId => ({
                product_id: productId,
                tag_id: tagId
            }));
            await supabase.from("product_tags").insert(tagInserts);
        }

        revalidatePath("/admin/catalog/products");
        revalidatePath(`/admin/catalog/products/${productId}`);
        return { success: true, id: productId };

    } catch (e: any) {
        console.error("Upsert Product Error:", e);
        return { error: e.message };
    }
}

export async function deleteProduct(id: string) {
    // Determine if we should delete from Stripe or just archive.
    // Usually archive.
    try {
        const isAllowed = await isAdminOrOwner();
        if (!isAllowed) {
            return { error: "Unauthorized" };
        }

        await stripe.products.update(id, { active: false });

        // Delete from Supabase (or set active=false via sync? No, let's just delete for cleanup if that's the intention, 
        // OR just set active=false. The delete action implies removal.)
        // But removing from Stripe is hard (only if no transactions).
        // Let's just Archive in Stripe and Delete in Supabase (which might break webhook sync if it updates archived products?)

        // Safer: Set active = false in Supabase.
        const supabase = createSystemClient();
        await supabase.from("products").update({ active: false }).eq("id", id);

        revalidatePath("/admin/catalog/products");
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}
