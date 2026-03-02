"use client";

import { useState, useEffect } from "react";
import { Modal, ModalOverlay, Dialog } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { TextArea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { upsertCategory, type Category } from "@/app/actions/categories";
import { useToast } from "@/components/ui/Toast";
import { X } from "lucide-react";

interface UpsertCategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    categoryToEdit?: Category | null;
    allCategories: Category[];
}

export function UpsertCategoryModal({ isOpen, onClose, categoryToEdit, allCategories }: UpsertCategoryModalProps) {
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [description, setDescription] = useState("");
    const [imageUrl, setImageUrl] = useState("");
    const [parentId, setParentId] = useState<string | null>(null);

    useEffect(() => {
        if (categoryToEdit) {
            setName(categoryToEdit.name);
            setSlug(categoryToEdit.slug);
            setDescription(categoryToEdit.description || "");
            setImageUrl(categoryToEdit.image_url || "");
            setParentId(categoryToEdit.parent_id || "none");
        } else {
            setName("");
            setSlug("");
            setDescription("");
            setImageUrl("");
            setParentId("none");
        }
    }, [categoryToEdit, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const res = await upsertCategory({
                id: categoryToEdit?.id,
                name,
                slug,
                description,
                image_url: imageUrl,
                parent_id: parentId === "none" ? undefined : parentId || undefined
            });

            if (res.error) {
                addToast({ title: "Error", description: res.error, type: "error" });
            } else {
                addToast({
                    title: "Success",
                    description: categoryToEdit ? "Category updated" : "Category created",
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

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newName = e.target.value;
        setName(newName);
        if (!categoryToEdit) {
            setSlug(newName.toLowerCase().replace(/ /g, "-").replace(/[^\w-]+/g, ""));
        }
    };

    return (
        <ModalOverlay isOpen={isOpen} onOpenChange={(open) => !open && onClose()} isDismissable>
            <Modal className="w-full max-w-lg bg-white p-6 rounded-xl shadow-xl">
                <Dialog className="outline-none">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-semibold text-gray-900">
                            {categoryToEdit ? "Edit Category" : "New Category"}
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
                                onChange={handleNameChange}
                                placeholder="e.g. Electronics"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Slug</Label>
                            <Input
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                placeholder="e.g. electronics"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Parent Category</Label>
                            <Select
                                selectedKey={parentId}
                                onSelectionChange={(key) => setParentId(key as string)}
                                placeholder="None"
                            >
                                <Select.Item id="none">None</Select.Item>
                                {allCategories
                                    .filter(c => c.id !== categoryToEdit?.id) // Prevent self-parenting
                                    .map(c => (
                                        <Select.Item id={c.id} key={c.id}>{c.name}</Select.Item>
                                    ))}
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Image URL</Label>
                            <Input
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                placeholder="https://..."
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <TextArea
                                value={description}
                                onChange={setDescription}
                                placeholder="Category description..."
                            />
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
