import { createMiddlewareClient } from "@/lib/supabase/middleware";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
    const { supabase, supabaseResponse } = createMiddlewareClient(request);

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake can make it very hard to debug
    // issues with users being randomly logged out.

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    // Roteamento público (sempre permitido)
    const isPublicPath =
        pathname === "/" ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/signup") ||
        pathname.startsWith("/forgot-password") ||
        pathname.startsWith("/auth") ||
        pathname.startsWith("/api/webhooks") ||
        pathname.startsWith("/api/checkout") ||
        pathname.startsWith("/products") ||
        pathname.startsWith("/pricing") ||
        pathname.startsWith("/contact") ||
        pathname.startsWith("/checkout") ||
        pathname.startsWith("/invite");

    // Roteamento explicitamente protegido
    const protectedPaths = [
        "/dashboard",
        "/admin",
        "/settings",
        "/projects",
        "/users",
        "/notifications",
        "/support",
        "/profile",
        "/orders",
    ];

    const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

    if (!user && isProtectedPath && !isPublicPath) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        // Mantém a URL original como parâmetro para redirecionar de volta após login (opcional)
        // url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
