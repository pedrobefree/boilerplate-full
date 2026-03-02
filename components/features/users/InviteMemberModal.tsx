"use client";

import { X, Mail, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal, ModalOverlay, Dialog } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useState } from "react";
import { cx } from "@/lib/utils";
import { inviteMember } from "@/app/actions/users";
import { useToast } from "@/components/ui/Toast";
import { useOrganization } from "@/app/context/OrganizationContext";

interface InviteMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    isSuperAdmin?: boolean;
}

export const InviteMemberModal = ({ isOpen, onClose, onSuccess, isSuperAdmin = false }: InviteMemberModalProps) => {
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<"owner" | "admin" | "member">("member");
    const [isLoading, setIsLoading] = useState(false);
    const { addToast } = useToast();
    const { currentOrganization } = useOrganization();
    const viewerRole = currentOrganization?.role || "member";

    const availableRoles = [
        { id: "owner", title: "Owner", desc: "Full access and can manage billing" },
        { id: "admin", title: "Admin", desc: "Can manage settings and members" },
        { id: "member", title: "Member", desc: "Can view and edit resources" }
    ].filter(r => {
        if (isSuperAdmin) return true;
        if (viewerRole === "owner") return true;
        if (viewerRole === "admin") return r.id !== "owner";
        return false;
    });

    const handleInvite = async () => {
        if (!email.trim() || !email.includes("@")) return;

        setIsLoading(true);
        try {
            const result = await inviteMember(email, role);
            if (result.success) {
                addToast({ title: "Member invited successfully", type: "success" });
                setEmail("");
                setRole("member");
                onSuccess?.();
            } else {
                addToast({ title: "Failed to invite member", description: result.error, type: "error" });
            }
        } catch (error) {
            addToast({ title: "Error inviting member", type: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setEmail("");
        setRole("member");
        onClose();
    };

    return (
        <ModalOverlay isOpen={isOpen} onOpenChange={handleClose} isDismissable>
            <Modal className="sm:max-w-md">
                <Dialog className="outline-none">
                    <div className="relative">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-900">Invite Team Member</h2>
                            <p className="text-sm text-gray-500 mt-1">Add an existing user to your workspace</p>
                            <button
                                onClick={handleClose}
                                className="absolute right-6 top-6 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        {/* Form Body */}
                        <div className="p-6 space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                    <Mail className="size-4 text-gray-400" /> Email Address
                                </label>
                                <Input
                                    type="email"
                                    placeholder="user@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoFocus
                                />
                                <p className="text-xs text-gray-500">User must have an existing account to be added.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                    <Shield className="size-4 text-gray-400" /> Role
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    {availableRoles.map((r) => (
                                        <button
                                            key={r.id}
                                            onClick={() => setRole(r.id as any)}
                                            className={cx(
                                                "flex items-start gap-3 p-3 rounded-lg border transition-all text-left",
                                                role === r.id
                                                    ? "bg-brand-50 border-brand-200 ring-2 ring-brand-500/10"
                                                    : "bg-white border-gray-100 hover:border-gray-200"
                                            )}
                                        >
                                            <div className={cx(
                                                "size-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0",
                                                role === r.id ? "border-brand-600 bg-brand-600" : "border-gray-200"
                                            )}>
                                                {role === r.id && <div className="size-1.5 rounded-full bg-white" />}
                                            </div>
                                            <div>
                                                <p className={cx("text-sm font-bold", role === r.id ? "text-brand-900" : "text-gray-900")}>{r.title}</p>
                                                <p className="text-xs text-gray-500">{r.desc}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-3 rounded-b-xl">
                            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
                            <Button
                                onClick={handleInvite}
                                isDisabled={!email.trim() || !email.includes("@") || isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="size-4 animate-spin mr-2" />
                                        Adding...
                                    </>
                                ) : (
                                    "Add Member"
                                )}
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
};
