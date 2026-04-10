"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getMyOrganizations } from "@/app/actions/organizations";
import { setActiveOrganization, getActiveOrganizationId } from "@/app/actions/organization-context";
import { useAuth } from "@/components/features/auth/AuthProvider";
import { useToast } from "@/components/ui/Toast";

// Define the shape of an Organization (matching DB schema roughly)
// We can import the exact type if generated, but for now interface is fine.
export interface Organization {
    id: string;
    name: string;
    slug: string;
    subscription_status?: string;
    role?: string; // from the join
}

interface OrganizationContextType {
    organizations: Organization[];
    currentOrganization: Organization | null;
    isLoading: boolean;
    switchOrganization: (orgId: string) => Promise<void>;
    refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();

    const fetchOrganizations = async () => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        try {
            // 1. Fetch all orgs user belongs to
            const orgsData = await getMyOrganizations();

            if (!orgsData.success) {
                console.error("Failed to load organizations:", orgsData.error);
                addToast({
                    title: "Error loading workspace",
                    description: orgsData.error,
                    type: "error"
                });
                return;
            }

            // Map keys if necessary, or just use as is. 
            // The select query in getMyOrganizations is: *, organization_members!inner(role)
            const rolePriority = { 'owner': 4, 'admin': 3, 'member': 2, 'customer': 1 };
            
            const formattedOrgs = orgsData.data.map((item: any) => {
                // Pick the highest role from the members array
                const roles = item.organization_members?.map((m: any) => m.role) || [];
                const highestRole = roles.reduce((prev: string, curr: string) => {
                    return (rolePriority[curr as keyof typeof rolePriority] || 0) > 
                           (rolePriority[prev as keyof typeof rolePriority] || 0) ? curr : prev;
                }, roles[0]);

                return {
                    id: item.id,
                    name: item.name,
                    slug: item.slug,
                    subscription_status: item.subscription_status,
                    role: highestRole
                };
            });

            setOrganizations(formattedOrgs);

            // 2. Determine active org
            const savedOrgId = await getActiveOrganizationId();

            let active = null;
            if (savedOrgId) {
                active = formattedOrgs.find((o: Organization) => o.id === savedOrgId);
            }

            // Fallback: If no saved org or saved org not valid, pick the first one
            if (!active && formattedOrgs.length > 0) {
                active = formattedOrgs[0];
                // Automatically save this fallback
                await setActiveOrganization(active.id);
            }

            setCurrentOrganization(active || null);

        } catch (error) {
            console.error("Failed to load organizations:", error);
            addToast({
                title: "Error loading workspace",
                description: "Could not fetch your organizations.",
                type: "error"
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Re-fetch when user changes (login/logout)
    useEffect(() => {
        fetchOrganizations();
    }, [user]);

    const switchOrganization = async (orgId: string) => {
        const org = organizations.find(o => o.id === orgId);
        if (!org) {
            console.error("Attempted to switch to invalid org ID:", orgId);
            return;
        }

        try {
            await setActiveOrganization(orgId);
            setCurrentOrganization(org);
            addToast({
                title: `Switched to ${org.name}`,
                type: "success"
            });
            // Optional: Router refresh to reload server components with new cookie
            // router.refresh(); 
        } catch (error) {
            console.error("Failed to switch organization:", error);
            addToast({
                title: "Failed to switch",
                type: "error"
            });
        }
    };

    return (
        <OrganizationContext.Provider value={{
            organizations,
            currentOrganization,
            isLoading,
            switchOrganization,
            refreshOrganizations: fetchOrganizations
        }}>
            {children}
        </OrganizationContext.Provider>
    );
}

export function useOrganization() {
    const context = useContext(OrganizationContext);
    if (context === undefined) {
        throw new Error("useOrganization must be used within an OrganizationProvider");
    }
    return context;
}
