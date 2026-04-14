"use server";

import { createClient, createSystemClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { recordCurrentUserActivity } from "@/lib/activity-log";
import { buildAppUrl, sendOrderCancelledEmail } from "@/lib/email";

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

const STATUS_RANKS: Record<string, number> = {
    'Waiting for Payment': 1,
    'Payment Approved': 2,
    'Pending Delivery': 3,
    'Completed': 4,
    'Canceled': 5
};

export async function updateOrderStatus(orderId: string, status: string) {
    const supabase = await createClient();

    // 1. Fetch current status for validation
    const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('status, stripe_payment_intent_id, organization_id, user_id, billing_details')
        .eq('id', orderId)
        .single();

    if (fetchError || !order) {
        console.error("Error fetching order for update:", fetchError);
        return { success: false, error: fetchError?.message || 'Order not found' };
    }

    const currentRank = STATUS_RANKS[order.status] || 0;
    const newRank = STATUS_RANKS[status] || 0;

    // 2. Validate sequence
    // Rule: Cannot go back in sequence, unless it's a cancellation from a non-completed state.
    if (status !== 'Canceled') {
        if (newRank <= currentRank && order.status !== status) {
            return {
                success: false,
                error: `Cannot change status from "${order.status}" to "${status}". Status must follow the sequential order.`
            };
        }
    } else {
        // Validation for 'Canceled'
        if (order.status === 'Completed') {
            return { success: false, error: 'Cannot cancel a completed order.' };
        }
        if (order.status === 'Canceled') {
            return { success: false, error: 'Order is already canceled.' };
        }
    }

    // 3. Handle Refund for Cancellation
    if (status === 'Canceled') {
        if (order.stripe_payment_intent_id) {
            try {
                console.log(`[Stripe] Initiating refund for order ${orderId} (PI: ${order.stripe_payment_intent_id})`);
                await stripe.refunds.create({
                    payment_intent: order.stripe_payment_intent_id
                });
                console.log(`[Stripe] Refund successfully processed for order ${orderId}`);
            } catch (err: any) {
                console.error("[Stripe] Error processing refund:", err);
                return { success: false, error: `Stripe Refund Error: ${err.message}` };
            }
        }
    }

    // 4. Update order status
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
    if (error) {
        console.error("Error updating order status in DB:", error);
        return { success: false, error: error.message };
    }

    await recordCurrentUserActivity({
        organizationId: order.organization_id,
        action: status === "Canceled" ? "order_cancelled" : "order_status_changed",
        entityType: "orders",
        entityId: orderId,
        metadata: {
            previousStatus: order.status,
            nextStatus: status,
        },
    });

    if (status === "Canceled" && order.status !== "Canceled") {
        try {
            let recipientEmail = order.billing_details?.email as string | undefined;
            let recipientName = order.billing_details?.name as string | undefined;

            if (!recipientEmail && order.user_id) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("email, full_name")
                    .eq("id", order.user_id)
                    .maybeSingle();

                recipientEmail = profile?.email || recipientEmail;
                recipientName = profile?.full_name || recipientName;
            }

            if (recipientEmail) {
                await sendOrderCancelledEmail({
                    to: recipientEmail,
                    customerName: recipientName,
                    orderNumber: orderId.slice(0, 8).toUpperCase(),
                    orderUrl: buildAppUrl(`/orders/${orderId}`),
                    refundWindow: "5 a 10 dias úteis",
                });
            }
        } catch (emailError) {
            console.error("[orders] Failed to send cancellation email", emailError);
        }
    }

    return { success: true };
}

export async function getOrderByPaymentIntent(paymentIntentId: string) {
    const supabase = await createClient();
    
    // We use the normal client first to see if the user is logged in and owns it
    const { data: order } = await supabase
        .from('orders')
        .select('*, items:order_items(id, quantity, unit_amount, product:products(name))')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .single();

    if (order) return order;

    // If not found (likely guest), use system client but ONLY if PI ID is provided
    // This is safe because the client must know the PI ID to call this.
    const systemClient = createSystemClient();
    const { data: guestOrder, error: guestError } = await systemClient
        .from('orders')
        .select('*, items:order_items(id, quantity, unit_amount, product:products(name))')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .single();

    if (guestError) {
        console.error("Error fetching guest order:", guestError);
        return null;
    }

    return guestOrder;
}
