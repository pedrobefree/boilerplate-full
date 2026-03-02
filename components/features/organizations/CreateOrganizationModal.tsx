"use client";

import React, { useState } from "react";
import { Dialog, Modal, ModalOverlay } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createOrganization } from "@/app/actions/organizations";
import { useToast } from "@/components/ui/Toast";
import { useOrganization } from "@/app/context/OrganizationContext";

interface CreateOrganizationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CreateOrganizationModal({ isOpen, onClose }: CreateOrganizationModalProps) {
    const { addToast } = useToast();
    const { switchOrganization, refreshOrganizations } = useOrganization();

    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        slug: ""
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const generateSlug = (name: string) => {
        return name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 7);
    };

    const handleNameBlur = () => {
        if (formData.name && !formData.slug) {
            setFormData(prev => ({ ...prev, slug: generateSlug(prev.name) }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const result = await createOrganization(formData.name, formData.slug);

            if (!result.success) {
                throw new Error(result.error);
            }

            addToast({
                title: "Organization created!",
                type: "success"
            });

            await refreshOrganizations();
            await switchOrganization(result.data.id);

            onClose();
            // Reset form
            setFormData({ name: "", slug: "" });

        } catch (error: any) {
            addToast({
                title: "Failed to create organization",
                description: error.message,
                type: "error"
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ModalOverlay isOpen={isOpen} onOpenChange={onClose} isDismissable>
            <Modal className="sm:max-w-md">
                <Dialog className="outline-none">
                    <div className="p-6">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Create New Workspace</h2>
                            <p className="mt-1 text-sm text-gray-500">
                                Workspaces are isolated environments for your projects and team.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                label="Workspace Name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                onBlur={handleNameBlur}
                                placeholder="e.g. Acme Corp"
                                required
                            />

                            <Input
                                label="Workspace Slug"
                                name="slug"
                                value={formData.slug}
                                onChange={handleChange}
                                placeholder="e.g. acme-corp-x8s2"
                                helperText="Unique URL identifier for your workspace."
                                required
                            />

                            <div className="mt-6 flex justify-end gap-3">
                                <Button
                                    variant="secondary"
                                    type="button"
                                    onClick={onClose}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    isDisabled={isLoading}
                                >
                                    {isLoading ? "Creating..." : "Create Workspace"}
                                </Button>
                            </div>
                        </form>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
