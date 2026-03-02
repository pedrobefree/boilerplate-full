"use client";

import { MoreVertical, RefreshCw, Mail, Clock, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useState, useEffect } from "react";
import { getOrganizationInvitations } from "@/app/actions/users";
import { resendInvitation, cancelInvitation } from "@/app/actions/invitations";
import { useToast } from "@/components/ui/Toast";
import { Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";

interface Invite {
    id: string;
    email: string;
    role: "owner" | "admin" | "member";
    status: "pending" | "accepted" | "denied" | "expired" | "cancelled" | "user_removed";
    token: string;
    expires_at: string;
    created_at: string;
}

interface InvitesListProps {
    refreshTrigger?: number;
    onInviteCancelled?: () => void;
}

export const InvitesList = ({ refreshTrigger, onInviteCancelled }: InvitesListProps) => {
    const [invites, setInvites] = useState<Invite[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("all");
    const [inviteToCancel, setInviteToCancel] = useState<Invite | null>(null);
    const { addToast } = useToast();

    const fetchInvites = async () => {
        setIsLoading(true);
        try {
            const result = await getOrganizationInvitations(statusFilter);
            if (result.success) {
                setInvites(result.data);
            } else {
                addToast({ title: "Failed to load invites", description: result.error, type: "error" });
            }
        } catch (error) {
            addToast({ title: "Error loading invites", type: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchInvites();
    }, [statusFilter, refreshTrigger]);

    const handleResend = async (invite: Invite) => {
        try {
            const result = await resendInvitation(invite.id);
            if (result.success) {
                addToast({ title: "Invitation resent", type: "success" });
                fetchInvites();
            } else {
                addToast({ title: "Failed to resend", description: result.error, type: "error" });
            }
        } catch (error) {
            addToast({ title: "Error resending invitation", type: "error" });
        }
    };

    const handleCancel = async (invite: Invite) => {
        setInviteToCancel(invite);
    };

    const confirmCancel = async () => {
        if (!inviteToCancel) return;

        try {
            const result = await cancelInvitation(inviteToCancel.id);
            if (result.success) {
                addToast({ title: "Invitation cancelled", type: "success" });
                onInviteCancelled?.();
                fetchInvites();
            } else {
                addToast({ title: "Failed to cancel", description: result.error, type: "error" });
            }
        } catch (error) {
            addToast({ title: "Error cancelling invitation", type: "error" });
        } finally {
            setInviteToCancel(null);
        }
    };

    const getStatusBadge = (status: Invite["status"]) => {
        switch (status) {
            case "pending": return <Badge variant="brand" size="sm">Pending</Badge>;
            case "accepted": return <Badge variant="success" size="sm">Accepted</Badge>;
            case "denied": return <Badge variant="error" size="sm">Denied</Badge>;
            case "expired": return <Badge variant="default" size="sm">Expired</Badge>;
            case "user_removed": return <Badge variant="error" size="sm">User Removed</Badge>;
            default: return <Badge variant="default" size="sm">{status}</Badge>;
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                <div className="flex gap-2">
                    {["all", "pending", "accepted", "expired"].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${statusFilter === status
                                ? "bg-white text-brand-700 shadow-sm border border-gray-200"
                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                                }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
                <Button variant="tertiary" size="sm" onClick={fetchInvites} isDisabled={isLoading}>
                    <RefreshCw className={`size-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            <div className="overflow-hidden bg-white rounded-xl border border-gray-200">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <RefreshCw className="size-6 text-gray-400 animate-spin" />
                    </div>
                ) : invites.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50/30">
                        <Mail className="size-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No invitations found</p>
                        <p className="text-sm text-gray-400">Try adjusting your filters or invite someone new.</p>
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Recipient</th>
                                <th className="px-6 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Expires</th>
                                <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {invites.map((invite) => (
                                <tr key={invite.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-gray-100 rounded-lg">
                                                <Mail className="size-4 text-gray-500" />
                                            </div>
                                            <span className="text-sm font-medium text-gray-900">{invite.email}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm text-gray-600 capitalize">{invite.role}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant={
                                                    invite.status === "pending" ? "warning" :
                                                        invite.status === "accepted" ? "success" :
                                                            invite.status === "expired" ? "error" :
                                                                "default"
                                                }
                                            >
                                                {invite.status}
                                            </Badge>
                                            {invite.status === "pending" && (
                                                <Button
                                                    variant="tertiary"
                                                    size="sm"
                                                    className="h-7 text-[10px] font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50"
                                                    onClick={() => {
                                                        const url = `${window.location.origin}/signup?invite=${invite.token}`;
                                                        navigator.clipboard.writeText(url);
                                                        addToast({ title: "Invite link copied", type: "success" });
                                                    }}
                                                >
                                                    Copy Link
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center text-xs text-gray-500">
                                            <Clock className="size-3.5 mr-1" />
                                            {formatDate(invite.expires_at)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <MenuTrigger>
                                            <Button variant="tertiary" size="sm">
                                                <MoreVertical className="size-4 text-gray-400" />
                                            </Button>
                                            <Popover className="min-w-[140px] p-1 bg-white rounded-lg border border-gray-200 shadow-xl outline-none">
                                                <Menu className="outline-none" onAction={(key) => {
                                                    if (key === "resend") handleResend(invite);
                                                    if (key === "cancel") handleCancel(invite);
                                                }}>
                                                    {(invite.status === "pending" || invite.status === "expired") && (
                                                        <MenuItem id="resend" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-brand-50 hover:text-brand-700 outline-none cursor-pointer">
                                                            <RefreshCw className="size-3.5" /> Resend
                                                        </MenuItem>
                                                    )}
                                                    <MenuItem id="cancel" className="flex items-center gap-2 px-3 py-2 text-sm text-error-600 rounded-md hover:bg-error-50 outline-none cursor-pointer">
                                                        <XCircle className="size-3.5" /> Cancel
                                                    </MenuItem>
                                                </Menu>
                                            </Popover>
                                        </MenuTrigger>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <ConfirmDialog
                isOpen={!!inviteToCancel}
                onClose={() => setInviteToCancel(null)}
                onConfirm={confirmCancel}
                title="Cancel invitation"
                description={`Are you sure you want to cancel the invitation for ${inviteToCancel?.email}? This action cannot be undone.`}
                confirmText="Cancel invitation"
                cancelText="Keep invitation"
                variant="destructive"
            />
        </div>
    );
};
