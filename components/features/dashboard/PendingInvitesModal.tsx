"use client";

import { useEffect, useState } from "react";
import { Dialog, Modal, ModalOverlay } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { getMyInvitations, acceptInvitation, Invitation } from "@/app/actions/invitations";
import { useToast } from "@/components/ui/Toast";
import { Loader2, Check, X, Shield, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";

export const PendingInvitesModal = () => {
    const [invites, setInvites] = useState<Invitation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const { addToast } = useToast();
    const router = useRouter();

    useEffect(() => {
        const fetchInvites = async () => {
            try {
                const results = await getMyInvitations();
                if (results.success && results.data.length > 0) {
                    setInvites(results.data);
                    setIsOpen(true);
                }
            } catch (error) {
                console.error("Failed to fetch invites:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInvites();
    }, []);

    const handleAccept = async (invite: Invitation) => {
        setActionLoading(invite.id);
        try {
            const result = await acceptInvitation(invite.token);
            if (result && result.success) {
                addToast({ title: `Joined ${invite.organization?.name || "organization"}!`, type: "success" });

                // Remove from list
                const remaining = invites.filter(i => i.id !== invite.id);
                setInvites(remaining);
                if (remaining.length === 0) setIsOpen(false);

                // Refresh to update org list
                router.refresh();
            } else {
                addToast({ title: "Failed to join", description: result?.error || "Unknown error", type: "error" });
            }
        } catch (error) {
            addToast({ title: "Error accepting invitation", type: "error" });
        } finally {
            setActionLoading(null);
        }
    };

    if (!isOpen || invites.length === 0) return null;

    return (
        <ModalOverlay isOpen={isOpen} onOpenChange={setIsOpen}>
            <Modal className="sm:max-w-md">
                <Dialog className="outline-none">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Shield className="size-5 text-brand-600" />
                            Pending Invitations
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            You have been invited to join the following organizations.
                        </p>
                    </div>

                    <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                        {isLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="size-8 text-brand-500 animate-spin" />
                            </div>
                        ) : (
                            invites.map((invite) => (
                                <div key={invite.id} className="flex flex-col gap-3 p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center p-1 shadow-sm">
                                                {invite.organization?.logo_url ? (
                                                    <img src={invite.organization.logo_url} alt="" className="w-full h-full object-contain" />
                                                ) : (
                                                    <Building2 className="size-5 text-gray-400" />
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900">{invite.organization?.name || "Unknown Org"}</h3>
                                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                                    Invited as <span className="font-medium text-brand-600 capitalize">{invite.role}</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button
                                            className="flex-1"
                                            onClick={() => handleAccept(invite)}
                                            isDisabled={!!actionLoading}
                                        >
                                            {actionLoading === invite.id ? (
                                                <Loader2 className="size-4 animate-spin mr-1.5" />
                                            ) : (
                                                <Check className="size-4 mr-1.5" />
                                            )}
                                            Accept Invite
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-center">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-xs text-gray-500 hover:text-gray-700 underline"
                        >
                            Decide later
                        </button>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
};
