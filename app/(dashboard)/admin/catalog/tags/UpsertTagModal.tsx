"use client";

import { useState, useEffect } from "react";
import { Modal, ModalOverlay, Dialog } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

import { upsertTag, type Tag } from "@/app/actions/tags";
import { useToast } from "@/components/ui/Toast";
import { X } from "lucide-react";

interface UpsertTagModalProps {
    isOpen: boolean;
    onClose: () => void;
    tagToEdit?: Tag | null;
}

const PRESET_COLORS = [
    "#EF4444", // Red
    "#F97316", // Orange
    "#F59E0B", // Amber
    "#10B981", // Emerald
    "#06B6D4", // Cyan
    "#3B82F6", // Blue
    "#6366F1", // Indigo
    "#8B5CF6", // Violet
    "#EC4899", // Pink
    "#64748B", // Slate
];

export function UpsertTagModal({ isOpen, onClose, tagToEdit }: UpsertTagModalProps) {
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [name, setName] = useState("");

    const [color, setColor] = useState("#64748B");

    useEffect(() => {
        if (tagToEdit) {
            setName(tagToEdit.name);

            setColor(tagToEdit.color || "#64748B");
        } else {
            setName("");

            setColor("#64748B");
        }
    }, [tagToEdit, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await upsertTag({
                id: tagToEdit?.id,
                name,
                color
            });

            if (res.error) {
                addToast({ title: "Error", description: res.error, type: "error" });
            } else {
                addToast({
                    title: "Success",
                    description: tagToEdit ? "Tag updated" : "Tag created",
                    type: "success"
                });
                onClose();
            }
        } catch (error) {
            console.error(error);
            addToast({ title: "Error", description: "Something went wrong", type: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ModalOverlay isOpen={isOpen} onOpenChange={(open) => !open && onClose()} isDismissable>
            <Modal className="w-full max-w-md bg-white p-6 rounded-xl shadow-xl">
                <Dialog className="outline-none">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-gray-900">
                            {tagToEdit ? "Edit Tag" : "New Tag"}
                        </h2>
                        <Button variant="tertiary" onPress={onClose} className="p-2">
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. New Arrival"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Color</Label>
                            <div className="flex gap-2 flex-wrap">
                                {PRESET_COLORS.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setColor(c)}
                                        className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? "border-gray-900 scale-110" : "border-transparent hover:scale-105"
                                            }`}
                                        style={{ backgroundColor: c }}
                                        aria-label={`Select color ${c}`}
                                    />
                                ))}
                                <div className="border-l pl-2 ml-2 flex items-center">
                                    <input
                                        type="color"
                                        value={color}
                                        onChange={(e) => setColor(e.target.value)}
                                        className="h-8 w-8 p-0 border-0 rounded cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end gap-2">
                            <Button variant="secondary" onPress={onClose} isDisabled={isLoading}>
                                Cancel
                            </Button>
                            <Button type="submit" isDisabled={isLoading}>
                                {isLoading ? "Saving..." : "Save"}
                            </Button>
                        </div>
                    </form>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
