"use client";

import { useAuth } from "@/components/features/auth/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Dropdown } from "@/components/ui/Dropdown";
import { LogOut, User as UserIcon, Package, LayoutDashboard, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export const UserMenu = () => {
    const { user, signOut } = useAuth();
    const router = useRouter();
    const [isAdmin, setIsAdmin] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        const checkRole = async () => {
            if (!user) return;
            const { data: memberships } = await supabase
                .from('organization_members')
                .select('role')
                .eq('user_id', user.id);
            
            const hasAdminRole = memberships?.some(m => m.role === 'admin' || m.role === 'owner');
            setIsAdmin(!!hasAdminRole);
        };

        checkRole();
    }, [user, supabase]);

    if (!user) return null;

    const initials = user.user_metadata?.full_name
        ?.split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase() || user.email?.[0].toUpperCase();

    return (
        <Dropdown.Root>
            <Dropdown.DotsButton className="flex items-center gap-2 p-0 bg-transparent border-none">
                <Avatar 
                    src={user.user_metadata?.avatar_url} 
                    alt={user.user_metadata?.full_name || user.email || ""} 
                    initials={initials}
                    size="sm"
                />
            </Dropdown.DotsButton>
            <Dropdown.Popover>
                <Dropdown.Menu onAction={(key) => {
                    if (key === 'logout') signOut();
                    else router.push(key as string);
                }}>
                    <Dropdown.Section>
                        <Dropdown.SectionHeader className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                            Account
                        </Dropdown.SectionHeader>
                        <Dropdown.Item id="/profile" label="Your Profile" icon={UserIcon} />
                        <Dropdown.Item id="/orders" label="My Orders" icon={Package} />
                    </Dropdown.Section>

                    {isAdmin && (
                        <>
                            <Dropdown.Separator />
                            <Dropdown.Section>
                                <Dropdown.SectionHeader className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                    Management
                                </Dropdown.SectionHeader>
                                <Dropdown.Item id="/admin" label="Admin Dashboard" icon={LayoutDashboard} />
                            </Dropdown.Section>
                        </>
                    )}

                    <Dropdown.Separator />
                    <Dropdown.Item id="logout" label="Log out" icon={LogOut} className="text-red-600 hover:bg-red-50" />
                </Dropdown.Menu>
            </Dropdown.Popover>
        </Dropdown.Root>
    );
};
