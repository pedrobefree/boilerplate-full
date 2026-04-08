import { MarketingHeader } from "@/components/layout/MarketingHeader";
import { MarketingFooter } from "@/components/layout/MarketingFooter";
import { CartProvider } from "@/app/context/CartContext";
import { CartSheet } from "@/components/features/CartSheet";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function CustomerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Check if user has customer role in any organization
    const { data: memberships } = await supabase
        .from('organization_members')
        .select('role')
        .eq('user_id', user.id);

    const isCustomer = memberships?.some(m => m.role === 'customer');
    const isAdmin = memberships?.some(m => m.role === 'admin' || m.role === 'owner');

    // If only admin, they shouldn't be here? (Requirement says if they login via header, go to customer area)
    // So we allow admins too.

    return (
        <CartProvider>
            <div className="flex flex-col min-h-screen bg-white">
                <MarketingHeader />
                <main className="flex-1 pt-24 pb-16 bg-gray-50/50">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        {children}
                    </div>
                </main>
                <MarketingFooter />
            </div>
            <CartSheet />
        </CartProvider>
    );
}
