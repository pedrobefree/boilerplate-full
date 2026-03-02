"use client";

import { X, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal, ModalOverlay, Dialog } from "@/components/ui/Modal";
import { useState, useEffect } from "react";
import { updateMemberDetails } from "@/app/actions/users";
import { useToast } from "@/components/ui/Toast";
import { cx } from "@/lib/utils";

interface Member {
    id: string;
    user_id: string;
    name: string;
    email: string;
    role: "owner" | "admin" | "member";
    avatar: string;
}

interface EditMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    member: Member | null;
    onSuccess?: () => void;
}

const ROLES = [
    { id: "owner" as const, title: "Owner", desc: "Full access and can manage billing" },
    { id: "admin" as const, title: "Admin", desc: "Can manage settings and members" },
    { id: "member" as const, title: "Member", desc: "Can view and edit resources" }
];

export const EditMemberModal = ({ isOpen, onClose, member, onSuccess }: EditMemberModalProps) => {
    const [role, setRole] = useState<Member["role"]>("member");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        if (member) {
            setRole(member.role);
            const nameParts = member.name.split(" ");
            setFirstName(nameParts[0] || "");
            setLastName(nameParts.slice(1).join(" ") || "");
        }
    }, [member]);

    const handleSave = async () => {
        if (!member) return;

        setIsLoading(true);
        try {
            const result = await updateMemberDetails(member.id, { role, firstName, lastName });
            if (result.success) {
                addToast({ title: "Member updated successfully", type: "success" });
                onSuccess?.();
            } else {
                addToast({ title: "Failed to update role", description: result.error, type: "error" });
            }
        } catch (error) {
            addToast({ title: "Error updating role", type: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    if (!member) return null;

    return (
        <ModalOverlay isOpen={isOpen} onOpenChange={onClose} isDismissable>
            <Modal className="sm:max-w-md">
                <Dialog className="outline-none">
                    <div className="relative">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-xl font-bold text-gray-900">Edit {member.name}</h2>
                            <p className="text-sm text-gray-500 mt-1">Manage role and permissions</p>
                            <button
                                onClick={onClose}
                                className="absolute right-6 top-6 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        {/* Form Body */}
                        <div className="p-6 space-y-6">
                            {/* Member Info */}
                            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                                <div className="h-12 w-12 rounded-full bg-brand-600 flex items-center justify-center text-white font-semibold">
                                    {member.avatar}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">{member.name}</p>
                                    <p className="text-sm text-gray-500">{member.email}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        label="First Name"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="First name"
                                    />
                                    <Input
                                        label="Last Name"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="Last name"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                        <Shield className="size-4 text-gray-400" /> Role
                                    </label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {ROLES.map((r) => (
                                            <button
                                                key={r.id}
                                                type="button"
                                                onClick={() => setRole(r.id)}
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
                                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                                <Button
                                    onClick={handleSave}
                                    isDisabled={
                                        (role === member.role &&
                                            firstName === member.name.split(" ")[0] &&
                                            lastName === member.name.split(" ").slice(1).join(" ")) ||
                                        isLoading
                                    }
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="size-4 animate-spin mr-2" />
                                            Saving...
                                        </>
                                    ) : (
                                        "Save Changes"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
};
