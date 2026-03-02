"use client";

import { useState, useMemo } from "react";
import { type Tag, deleteTag } from "@/app/actions/tags";
import { UpsertTagModal } from "./UpsertTagModal";
import { Button } from "@/components/ui/Button";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface TagListProps {
    tags: Tag[];
}

type SortField = "name" | "description" | "color";
type SortDirection = "asc" | "desc";

export function TagList({ tags }: TagListProps) {
    const { addToast } = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTag, setEditingTag] = useState<Tag | null>(null);

    // Delete confirmation state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [tagToDelete, setTagToDelete] = useState<string | null>(null);

    // Sort state
    const [sortField, setSortField] = useState<SortField>("name");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

    const handleCreate = () => {
        setEditingTag(null);
        setIsModalOpen(true);
    };

    const handleEdit = (tag: Tag) => {
        setEditingTag(tag);
        setIsModalOpen(true);
    };

    const handleDeleteClick = (id: string) => {
        setTagToDelete(id);
        setDeleteDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!tagToDelete) return;

        const res = await deleteTag(tagToDelete);
        if (res.error) {
            addToast({ title: "Error", description: res.error, type: "error" });
        } else {
            addToast({ title: "Success", description: "Tag deleted", type: "success" });
        }

        setDeleteDialogOpen(false);
        setTagToDelete(null);
    };

    // Handle sort
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection("asc");
        }
    };

    // Sorted tags
    const sortedTags = useMemo(() => {
        const sorted = [...tags];

        sorted.sort((a, b) => {
            let comparison = 0;

            switch (sortField) {
                case "name":
                    comparison = a.name.localeCompare(b.name);
                    break;
                case "description":
                    const descA = a.description || "";
                    const descB = b.description || "";
                    comparison = descA.localeCompare(descB);
                    break;
                case "color":
                    const colorA = a.color || "";
                    const colorB = b.color || "";
                    comparison = colorA.localeCompare(colorB);
                    break;
            }

            return sortDirection === "asc" ? comparison : -comparison;
        });

        return sorted;
    }, [tags, sortField, sortDirection]);

    // Sortable header component
    const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
        <th
            className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-700 cursor-pointer hover:bg-gray-50 select-none"
            onClick={() => handleSort(field)}
        >
            <div className="flex items-center gap-1">
                {children}
                {sortField === field && (
                    sortDirection === "asc" ?
                        <ChevronUp className="w-4 h-4" /> :
                        <ChevronDown className="w-4 h-4" />
                )}
            </div>
        </th>
    );

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Tags</h2>
                    <p className="text-sm text-gray-500">Manage product tags and labels</p>
                </div>
                <Button onPress={handleCreate} size="md">
                    <Plus className="w-4 h-4" />
                    Add Tag
                </Button>
            </div>

            {/* Table Card */}
            <Card>
                <CardHeader className="flex-row items-start justify-between">
                    <div>
                        <CardTitle className="text-lg">All Tags</CardTitle>
                        <CardDescription>{sortedTags.length} total tags</CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-y border-gray-100">
                                <tr>
                                    <SortableHeader field="name">Name</SortableHeader>
                                    <SortableHeader field="description">Description</SortableHeader>
                                    <SortableHeader field="color">Color</SortableHeader>
                                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-700">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {sortedTags.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                            No tags found. Create one to get started.
                                        </td>
                                    </tr>
                                ) : (
                                    sortedTags.map((tag) => (
                                        <tr key={tag.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <Badge
                                                    variant="default"
                                                    size="sm"
                                                    style={tag.color ? {
                                                        backgroundColor: `${tag.color}20`,
                                                        color: tag.color,
                                                        borderColor: `${tag.color}40`
                                                    } : undefined}
                                                >
                                                    {tag.name}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-500 truncate max-w-xs">{tag.description || "-"}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {tag.color ? (
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-4 h-4 rounded-full border border-gray-200"
                                                            style={{ backgroundColor: tag.color }}
                                                        />
                                                        <span className="text-xs text-gray-500 font-mono">{tag.color}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 text-sm">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Button size="sm" variant="tertiary" onPress={() => handleEdit(tag)}>
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="tertiary"
                                                        onPress={() => handleDeleteClick(tag.id)}
                                                        className="text-error-600 hover:text-error-700"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <UpsertTagModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                tagToEdit={editingTag}
            />

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={deleteDialogOpen}
                onClose={() => {
                    setDeleteDialogOpen(false);
                    setTagToDelete(null);
                }}
                onConfirm={handleDelete}
                title="Delete Tag"
                description="Are you sure you want to delete this tag? This action cannot be undone."
                confirmText="Delete"
                variant="destructive"
            />
        </div>
    );
}
