"use client";

import { Building, Plus, Search, MoreVertical, CheckCircle, XCircle, Edit2, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useState, useEffect, useMemo } from "react";
import { InviteMemberModal } from "./InviteMemberModal";
import { EditMemberModal } from "./EditMemberModal";
import { Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import { getOrganizationMembers, removeMember, OrganizationMember, getOrganizationInvitations } from "@/app/actions/users";
import { useToast } from "@/components/ui/Toast";
import { useOrganization } from "@/app/context/OrganizationContext";
import { useAuth } from "@/components/features/auth/AuthProvider";
import { isSuperAdmin as checkSuperAdmin } from "@/app/actions/auth-helpers";
import { InvitesList } from "./InvitesList";

interface DisplayMember {
    id: string;
    user_id: string;
    name: string;
    email: string;
    role: "owner" | "admin" | "member";
    avatar: string;
    created_at: string;
    organization?: { name: string; slug: string } | null;
}

export const UsersPage = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [orgFilter, setOrgFilter] = useState<string>("all");
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<DisplayMember | null>(null);
    const [members, setMembers] = useState<DisplayMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();
    const { currentOrganization } = useOrganization();
    const { user } = useAuth();
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    useEffect(() => {
        const checkAdmin = async () => {
            const isSuper = await checkSuperAdmin();
            setIsSuperAdmin(isSuper);
        };
        checkAdmin();
    }, []);

    const userRole = currentOrganization?.role || "member";
    const isAdmin = userRole === "admin" || userRole === "owner" || isSuperAdmin;

    const [activeTab, setActiveTab] = useState<"members" | "invites">("members");
    const [invitesCount, setInvitesCount] = useState({ pending: 0, expired: 0 });
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const triggerRefresh = () => {
        fetchMembers();
        fetchInvitesStats();
        setRefreshTrigger(prev => prev + 1);
    };

    const fetchMembers = async () => {
        setIsLoading(true);
        try {
            // If super admin, fetch all orgs
            const isSuper = await checkSuperAdmin(); // Check again to be sure or use state if ready
            // Using state might be risky if effect hasn't run, but fetchMembers calls usually happen after or triggered.
            // Let's pass the flag.

            const result = await getOrganizationMembers({ allOrgs: isSuper });
            if (result.success) {
                const formatted: DisplayMember[] = result.data.map((m: OrganizationMember & { organization: { name: string; slug: string } | null }) => ({
                    id: m.id,
                    user_id: m.user_id,
                    name: m.profile?.full_name || m.profile?.email?.split("@")[0] || "Unknown",
                    email: m.profile?.email || "unknown@email.com",
                    role: m.role,
                    avatar: getInitials(m.profile?.full_name || m.profile?.email || "U"),
                    created_at: m.created_at,
                    organization: m.organization
                }));
                setMembers(formatted);
            } else {
                console.error("Failed to fetch members:", result.error);
                addToast({ title: "Failed to load members", description: result.error, type: "error" });
            }
        } catch (error) {
            console.error("Error fetching members:", error);
            addToast({ title: "Error loading members", type: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchInvitesStats = async () => {
        try {
            const result = await getOrganizationInvitations();
            if (result.success) {
                const pending = result.data.filter((i: any) => i.status === "pending").length;
                const expired = result.data.filter((i: any) => i.status === "expired").length;
                setInvitesCount({ pending, expired });
            }
        } catch (error) {
            console.error("Error fetching invite stats:", error);
        }
    };

    useEffect(() => {
        if (currentOrganization || isSuperAdmin) {
            fetchMembers();
            fetchInvitesStats();
        }
    }, [currentOrganization, isSuperAdmin]); // Run when super admin state settles too

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map(n => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const [memberToDelete, setMemberToDelete] = useState<DisplayMember | null>(null);

    const handleDelete = async (member: DisplayMember) => {
        setMemberToDelete(member);
    };

    const confirmDelete = async () => {
        if (!memberToDelete) return;

        try {
            const result = await removeMember(memberToDelete.id);
            if (result.success) {
                addToast({ title: `${memberToDelete.name} removed`, type: "success" });
                fetchMembers();
            } else {
                addToast({ title: "Failed to remove member", description: result.error, type: "error" });
            }
        } catch (error) {
            addToast({ title: "Error removing member", type: "error" });
        } finally {
            setMemberToDelete(null);
        }
    };

    const uniqueOrgs = useMemo(() => {
        const orgs = new Map<string, string>();
        members.forEach(m => {
            if (m.organization) {
                orgs.set(m.organization.slug, m.organization.name);
            }
        });
        return Array.from(orgs.entries());
    }, [members]);

    const filteredMembers = members.filter(member => {
        const matchesSearch = member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            member.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesRole = roleFilter === "all" || member.role === roleFilter;
        const matchesOrg = orgFilter === "all" || member.organization?.slug === orgFilter;
        return matchesSearch && matchesRole && matchesOrg;
    });

    const getRoleColor = (role: DisplayMember["role"]) => {
        switch (role) {
            case "owner": return "error";
            case "admin": return "brand";
            case "member": return "default";
            default: return "default";
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };

    if (!currentOrganization && !isSuperAdmin) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-gray-500">Select an organization to view members.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-display-xs sm:text-display-sm font-bold text-gray-900 tracking-tight">Team Management</h1>
                    <p className="text-gray-500 text-base sm:text-lg mt-1">
                        Manage your team and invitations in <span className="font-medium text-gray-700">{isSuperAdmin && orgFilter === 'all' ? 'All Organizations' : currentOrganization?.name}</span>
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={triggerRefresh}
                        isDisabled={isLoading}
                    >
                        <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
                    </Button>
                    {isAdmin && (
                        <Button
                            className="gap-2 shadow-lg shadow-brand-500/20 flex-1 sm:flex-none"
                            onClick={() => setIsInviteModalOpen(true)}
                        >
                            <Plus className="size-4" /> Invite Member
                        </Button>
                    )}
                </div>
            </header>

            {/* KPIs */}
            <div className={`grid grid-cols-1 ${isAdmin ? 'sm:grid-cols-2 lg:grid-cols-3' : ''} gap-4`}>
                <Card className="bg-brand-50/50 border-brand-100 shadow-none">
                    <CardContent className="p-4">
                        <p className="text-xs font-semibold text-brand-700 uppercase tracking-wider">Total Members</p>
                        <p className="text-2xl font-bold text-brand-900 mt-1">{members.length}</p>
                    </CardContent>
                </Card>
                {isAdmin && (
                    <>
                        <Card className="bg-amber-50/50 border-amber-100 shadow-none">
                            <CardContent className="p-4">
                                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Pending Invites</p>
                                <p className="text-2xl font-bold text-amber-900 mt-1">{invitesCount.pending}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-gray-50/50 border-gray-100 shadow-none">
                            <CardContent className="p-4">
                                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Expired Invites</p>
                                <p className="text-2xl font-bold text-gray-800 mt-1">{invitesCount.expired}</p>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            {/* Tab Navigation & Filters */}
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200">
                    <div className="flex">
                        <button
                            onClick={() => setActiveTab("members")}
                            className={`px-6 py-3 text-sm font-medium border-b-2 transition-all ${activeTab === "members"
                                ? "border-brand-500 text-brand-600"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }`}
                        >
                            Members ({members.length})
                        </button>
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab("invites")}
                                className={`px-6 py-3 text-sm font-medium border-b-2 transition-all ${activeTab === "invites"
                                    ? "border-brand-500 text-brand-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                    }`}
                            >
                                Invites ({invitesCount.pending})
                            </button>
                        )}
                    </div>

                    {activeTab === "members" ? (
                        <div className="flex flex-col lg:flex-row gap-4">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search members..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-lg py-2 pl-10 pr-4 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                                    aria-label="Search team members"
                                />
                            </div>
                            {isSuperAdmin && (
                                <select
                                    value={orgFilter}
                                    onChange={(e) => setOrgFilter(e.target.value)}
                                    className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 max-w-[200px]"
                                    aria-label="Filter by organization"
                                >
                                    <option value="all">All Organizations</option>
                                    {uniqueOrgs.map(([slug, name]) => (
                                        <option key={slug} value={slug}>{name}</option>
                                    ))}
                                </select>
                            )}
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                                aria-label="Filter by role"
                            >
                                <option value="all">All Roles</option>
                                <option value="owner">Owner</option>
                                <option value="admin">Admin</option>
                                <option value="member">Member</option>
                            </select>
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Content List */}
            {activeTab === "members" ? (
                <Card className="overflow-hidden border-gray-200 shadow-sm">
                    <div className="overflow-x-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12 text-brand-600">
                                <RefreshCw className="size-6 animate-spin" />
                            </div>
                        ) : (
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Member</th>
                                        {isSuperAdmin && <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Organization</th>}
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Role</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Joined</th>
                                        {isAdmin && <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {filteredMembers.map((member) => (
                                        <tr key={member.id} className="hover:bg-gray-50/50 transition-colors group">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                                        {member.avatar}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-gray-900 truncate">{member.name}</p>
                                                        <p className="text-sm text-gray-500 truncate">{member.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            {isSuperAdmin && (
                                                <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                                                    {member.organization ? (
                                                        <div className="flex items-center gap-2">
                                                            <Building className="size-4 text-gray-400" />
                                                            <span className="text-sm font-medium text-gray-700">{member.organization.name}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-gray-400">-</span>
                                                    )}
                                                </td>
                                            )}
                                            <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                                                <Badge variant={getRoleColor(member.role)} size="sm" className="capitalize">
                                                    {member.role}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                                                {formatDate(member.created_at)}
                                            </td>
                                            {isAdmin && (
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <MenuTrigger>
                                                        <Button variant="tertiary" size="sm" className="p-2 h-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <MoreVertical className="size-4 text-gray-400" />
                                                        </Button>
                                                        <Popover className="min-w-[160px] p-1 bg-white rounded-lg border border-gray-200 shadow-xl outline-none">
                                                            <Menu className="outline-none" onAction={(key) => {
                                                                if (key === "edit") setUserToEdit(member);
                                                                if (key === "delete") handleDelete(member);
                                                            }}>
                                                                <MenuItem id="edit" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-50 outline-none cursor-pointer">
                                                                    <Edit2 className="size-4 text-gray-400" /> Edit user
                                                                </MenuItem>
                                                                <MenuItem id="delete" className="flex items-center gap-2 px-3 py-2 text-sm text-error-700 rounded-md hover:bg-error-50 outline-none cursor-pointer">
                                                                    <Trash2 className="size-4 text-error-400" /> Remove member
                                                                </MenuItem>
                                                            </Menu>
                                                        </Popover>
                                                    </MenuTrigger>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </Card>
            ) : (
                <InvitesList refreshTrigger={refreshTrigger} onInviteCancelled={triggerRefresh} />
            )}

            {!isLoading && filteredMembers.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-gray-500">
                        {members.length === 0
                            ? "No members in this organization yet."
                            : "No members found matching your criteria."}
                    </p>
                </div>
            )}

            <InviteMemberModal
                isOpen={isInviteModalOpen}
                onClose={() => setIsInviteModalOpen(false)}
                onSuccess={() => {
                    setIsInviteModalOpen(false);
                    triggerRefresh();
                }}
                isSuperAdmin={isSuperAdmin}
            />

            <EditMemberModal
                isOpen={!!userToEdit}
                onClose={() => setUserToEdit(null)}
                member={userToEdit}
                onSuccess={() => {
                    setUserToEdit(null);
                    triggerRefresh();
                }}
            />

            <ConfirmDialog
                isOpen={!!memberToDelete}
                onClose={() => setMemberToDelete(null)}
                onConfirm={confirmDelete}
                title="Remove team member"
                description={`Are you sure you want to remove ${memberToDelete?.name} from this organization? This action cannot be undone.`}
                confirmText="Remove member"
                cancelText="Cancel"
                variant="destructive"
            />
        </div>
    );
};
