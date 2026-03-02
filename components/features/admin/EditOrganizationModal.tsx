"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog, Modal, ModalOverlay } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { updateOrganizationAdmin } from "@/app/actions/admin";
import { Loader2 } from "lucide-react";

interface EditOrganizationModalProps {
    isOpen: boolean;
    onClose: () => void;
    organization: { id: string; name: string; slug: string } | null;
    onSuccess?: () => void;
}

export const EditOrganizationModal = ({ isOpen, onClose, organization, onSuccess }: EditOrganizationModalProps) => {
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        if (organization) {
            setName(organization.name);
            setSlug(organization.slug);
        }
    }, [organization]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!organization) return;

        setIsLoading(true);
        try {
            const res = await updateOrganizationAdmin(organization.id, { name, slug });
            if (res.success) {
                addToast({ title: "Organization updated", type: "success" });
                onSuccess?.();
                onClose();
            } else {
                addToast({ title: "Update failed", description: res.error, type: "error" });
            }
        } catch (error) {
            console.error(error);
            addToast({ title: "Update failed", type: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    if (!organization) return null;

    return (
        <ModalOverlay isOpen={isOpen} onOpenChange={onClose} isDismissable>
            <Modal className="sm:max-w-md">
                <Dialog className="outline-none">
                    <div className="p-6">
                        <h2 className="text-lg font-bold mb-4">Edit Organization</h2>
                        <form onSubmit={handleSave} className="space-y-4">
                            <Input
                                label="Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                            <Input
                                label="Slug"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                required
                            />
                            <div className="flex justify-end gap-2 mt-6">
                                <Button variant="secondary" onClick={onClose} isDisabled={isLoading}>
                                    Cancel
                                </Button>
                                <Button type="submit" isDisabled={isLoading}>
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
};
