import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "@/components/features/auth/AuthProvider";
import { APP_CONFIG, BRAND_CONFIG } from "@/lib/constants";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: {
        default: APP_CONFIG.name,
        template: `%s | ${APP_CONFIG.name}`,
    },
    description: APP_CONFIG.description,
    icons: {
        icon: BRAND_CONFIG.logo.icon,
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.className} antialiased`} suppressHydrationWarning={true}>
                <AuthProvider>
                    <ToastProvider>
                        {children}
                    </ToastProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
