"use server";

import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";

export interface OrderFilters {
    status?: string;
    search?: string;     // for customer name
    productId?: string;
    minValue?: number;
    maxValue?: number;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}

export async function getOrders(filters: OrderFilters = {}) {
    const supabase = await createClient();
    
    // We need to fetch orders that the admin has access to. RLS takes care of this.
    const { page = 1, limit = 10 } = filters;
    
    // Start query without profiles join
    let query = supabase.from("orders").select(`
        id, created_at, status, total_amount, currency, stripe_payment_intent_id, user_id, billing_details,
        items:order_items!inner(id, quantity, unit_amount, product_id, product:products(name))
    `, { count: 'exact' });

    // Status filter
    if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
    }
    
    // Value filters
    if (filters.minValue !== undefined && !Number.isNaN(filters.minValue)) {
        query = query.gte('total_amount', filters.minValue * 100); // assuming stored in cents
    }
    if (filters.maxValue !== undefined && !Number.isNaN(filters.maxValue)) {
        query = query.lte('total_amount', filters.maxValue * 100);
    }
    
    // Date filters
    if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
        const nextDay = new Date(filters.endDate);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query.lt('created_at', nextDay.toISOString());
    }

    // Product filter
    if (filters.productId) {
        query = query.eq('items.product_id', filters.productId);
    }

    // Text search (Customer name)
    if (filters.search) {
        const { data: matchedProfiles } = await supabase.from('profiles')
            .select('id')
            .or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%`);
            
        if (matchedProfiles && matchedProfiles.length > 0) {
            const userIds = matchedProfiles.map(p => p.id);
            query = query.in('user_id', userIds);
        } else {
            // No profiles match, force empty result with impossible UUID
            query = query.in('user_id', ['00000000-0000-0000-0000-000000000000']);
        }
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data: rawOrders, error, count } = await query;

    if (error) {
        console.error("Error fetching orders:", error);
        return { orders: [], count: 0, error: error.message };
    }

    const orders = rawOrders || [];

    // Fetch user profiles for the matching orders
    const userIds = Array.from(new Set(orders.map(o => o.user_id).filter(id => id != null)));
    
    let profilesMap: Record<string, any> = {};
    if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles')
            .select('id, first_name, last_name, avatar_url')
            .in('id', userIds);
            
        if (profiles) {
            profilesMap = profiles.reduce((acc: any, p: any) => {
                acc[p.id] = p;
                return acc;
            }, {});
        }
    }

    // Format output
    const formattedOrders = orders.map(order => {
        const items = (order.items as any[]) || [];
        const itemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
        return {
            ...order,
            itemsCount,
            user: order.user_id ? profilesMap[order.user_id] || null : null,
            items: items
        };
    });

    return { orders: formattedOrders, count, error: null };
}

export async function getOrderById(id: string) {
    const supabase = await createClient();

    const { data: order, error } = await supabase.from('orders').select(`
        *,
        items:order_items(id, quantity, unit_amount, product_id, product:products(name, description, image))
    `).eq('id', id).single();

    if (error) {
         console.error("Error fetching order details:", error);
         return null;
    }

    let userProfile = null;
    if (order.user_id) {
        const { data: profile } = await supabase.from('profiles')
            .select('id, first_name, last_name, full_name, email, avatar_url')
            .eq('id', order.user_id)
            .single();
        userProfile = profile;
    }

    return {
        ...order,
        user: userProfile
    };
}

export async function getPaymentIntentDetails(paymentIntentId: string) {
    if (!paymentIntentId) return null;
    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
            expand: ['latest_charge', 'payment_method']
        });
        return JSON.parse(JSON.stringify(paymentIntent)); // serialize for server action
    } catch (error) {
        console.error("Error fetching payment intent:", error);
        return null;
    }
}

export async function updateOrderStatus(orderId: string, status: string) {
    const supabase = await createClient();
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
    if (error) {
        console.error("Error updating order status:", error);
        return { success: false, error: error.message };
    }
    return { success: true };
}
