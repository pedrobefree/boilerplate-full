import { MarketingHeader } from "@/components/layout/MarketingHeader";
import { MarketingFooter } from "@/components/layout/MarketingFooter";
import { CartProvider } from "@/app/context/CartContext";
import { CartSheet } from "@/components/features/CartSheet";

export default function MarketingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <CartProvider>
            <div className="flex flex-col min-h-screen bg-white">
                <MarketingHeader />
                <main className="flex-1 pt-16">
                    {children}
                </main>
                <MarketingFooter />
            </div>
            <CartSheet />
        </CartProvider>
    );
}
