"use server";

import { stripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Fetches the Stripe Customer ID for the current authenticated user.
 * Looks into organizations where the user is a member (preferring 'customer' role).
 */
async function getStripeCustomerId() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    // Search for organization membership with a stripe_customer_id
    const { data: membership } = await supabase
        .from('organization_members')
        .select('organizations(stripe_customer_id)')
        .eq('user_id', user.id)
        .not('organizations.stripe_customer_id', 'is', null)
        .limit(1)
        .single() as any;

    return membership?.organizations?.stripe_customer_id || null;
}

/**
 * Lists all saved payment methods for the current user.
 */
export async function getMyPaymentMethods() {
    try {
        const customerId = await getStripeCustomerId();
        if (!customerId) return [];

        const paymentMethods = await stripe.paymentMethods.list({
            customer: customerId,
            type: 'card',
        });

        return paymentMethods.data.map(pm => ({
            id: pm.id,
            brand: pm.card?.brand,
            last4: pm.card?.last4,
            exp_month: pm.card?.exp_month,
            exp_year: pm.card?.exp_year,
            isDefault: false, // We'd need to check the customer's invoice_settings.default_payment_method
        }));
    } catch (error) {
        console.error("Error fetching payment methods:", error);
        return [];
    }
}

/**
 * Detaches (deletes) a payment method from the customer.
 */
export async function deletePaymentMethod(paymentMethodId: string) {
    try {
        // Security check: Verify the PM belongs to the user
        const customerId = await getStripeCustomerId();
        if (!customerId) throw new Error("No Stripe customer found");

        const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
        if (pm.customer !== customerId) {
            throw new Error("Unauthorized: Payment method does not belong to user");
        }

        await stripe.paymentMethods.detach(paymentMethodId);
        revalidatePath("/profile");
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting payment method:", error);
        return { success: false, error: error.message };
    }
}
