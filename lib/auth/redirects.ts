type SupabaseLikeClient = {
    from: (table: string) => {
        select: (columns: string) => {
            eq: (column: string, value: string) => any;
        };
    };
};

type AccessContext = {
    isSuperAdmin: boolean;
    hasDashboardAccess: boolean;
    hasCustomerAccess: boolean;
};

const DASHBOARD_PATH_PREFIXES = ["/dashboard", "/admin", "/settings", "/users", "/notifications", "/support"];
const CUSTOMER_PATH_PREFIXES = ["/orders", "/profile"];

function isSafeInternalPath(path?: string | null): path is string {
    return !!path && path.startsWith("/") && !path.startsWith("//");
}

function isDashboardPath(path: string) {
    return DASHBOARD_PATH_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
}

function isCustomerPath(path: string) {
    return CUSTOMER_PATH_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
}

export async function getUserAccessContext(supabaseClient: unknown, userId: string): Promise<AccessContext> {
    const supabase = supabaseClient as SupabaseLikeClient;

    const [{ data: profile }, { data: memberships }] = await Promise.all([
        supabase
            .from("profiles")
            .select("role")
            .eq("id", userId)
            .single(),
        supabase
            .from("organization_members")
            .select("role")
            .eq("user_id", userId),
    ]);

    const roles: string[] = memberships?.map((membership: { role: string }) => membership.role) ?? [];
    const isSuperAdmin = profile?.role === "super_admin";
    const hasDashboardAccess = isSuperAdmin || roles.some(role => role === "owner" || role === "admin" || role === "member");
    const hasCustomerAccess = roles.includes("customer");

    return {
        isSuperAdmin,
        hasDashboardAccess,
        hasCustomerAccess,
    };
}

export function resolveAuthorizedPath(access: AccessContext, preferredPath?: string | null): string {
    if (isSafeInternalPath(preferredPath)) {
        if (isDashboardPath(preferredPath)) {
            return access.hasDashboardAccess ? preferredPath : "/orders";
        }

        if (isCustomerPath(preferredPath)) {
            return preferredPath;
        }

        return preferredPath;
    }

    if (access.hasDashboardAccess) {
        return "/dashboard";
    }

    if (access.hasCustomerAccess) {
        return "/orders";
    }

    return "/dashboard";
}
