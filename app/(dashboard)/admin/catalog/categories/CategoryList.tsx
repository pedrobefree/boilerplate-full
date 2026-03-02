"use client";

import { useState, useMemo } from "react";
import { type Category, deleteCategory } from "@/app/actions/categories";
import { UpsertCategoryModal } from "./UpsertCategoryModal";
import { Button } from "@/components/ui/Button";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface CategoryListProps {
    categories: Category[];
}

type SortField = "name" | "slug" | "parent";
type SortDirection = "asc" | "desc";

export function CategoryList({ categories }: CategoryListProps) {
    const { addToast } = useToast();
    const [isExpectedModalOpen, setIsExpectedModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    // Delete confirmation state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

    // Sort state
    const [sortField, setSortField] = useState<SortField>("name");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

    const handleCreate = () => {
        setEditingCategory(null);
        setIsExpectedModalOpen(true);
    };

    const handleEdit = (category: Category) => {
        setEditingCategory(category);
        setIsExpectedModalOpen(true);
    };

    const handleDeleteClick = (id: string) => {
        setCategoryToDelete(id);
        setDeleteDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!categoryToDelete) return;

        const res = await deleteCategory(categoryToDelete);
        if (res.error) {
            addToast({ title: "Error", description: res.error, type: "error" });
        } else {
            addToast({ title: "Success", description: "Category deleted", type: "success" });
        }

        setDeleteDialogOpen(false);
        setCategoryToDelete(null);
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

    // Sorted categories
    const sortedCategories = useMemo(() => {
        const sorted = [...categories];

        sorted.sort((a, b) => {
            let comparison = 0;

            switch (sortField) {
                case "name":
                    comparison = a.name.localeCompare(b.name);
                    break;
                case "slug":
                    comparison = a.slug.localeCompare(b.slug);
                    break;
                case "parent":
                    const parentA = a.parent?.name || "";
                    const parentB = b.parent?.name || "";
                    comparison = parentA.localeCompare(parentB);
                    break;
            }

            return sortDirection === "asc" ? comparison : -comparison;
        });

        return sorted;
    }, [categories, sortField, sortDirection]);

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
                    <h2 className="text-xl font-bold text-gray-900">Categories</h2>
                    <p className="text-sm text-gray-500">Manage product categories and hierarchies</p>
                </div>
                <Button onPress={handleCreate} size="md">
                    <Plus className="w-4 h-4" />
                    Add Category
                </Button>
            </div>

            {/* Table Card */}
            <Card>
                <CardHeader className="flex-row items-start justify-between">
                    <div>
                        <CardTitle className="text-lg">All Categories</CardTitle>
                        <CardDescription>{sortedCategories.length} total categories</CardDescription>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-y border-gray-100">
                                <tr>
                                    <SortableHeader field="name">Name</SortableHeader>
                                    <SortableHeader field="slug">Slug</SortableHeader>
                                    <SortableHeader field="parent">Parent</SortableHeader>
                                    <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-widest text-gray-700">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {sortedCategories.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                            No categories found. Create one to get started.
                                        </td>
                                    </tr>
                                ) : (
                                    sortedCategories.map((category) => (
                                        <tr key={category.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{category.name}</div>
                                                {category.description && (
                                                    <div className="text-sm text-gray-500 truncate max-w-xs">{category.description}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">{category.slug}</code>
                                            </td>
                                            <td className="px-6 py-4">
                                                {category.parent ? (
                                                    <Badge variant="default" size="sm">{category.parent.name}</Badge>
                                                ) : (
                                                    <span className="text-gray-400 text-sm">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Button size="sm" variant="tertiary" onPress={() => handleEdit(category)}>
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="tertiary"
                                                        onPress={() => handleDeleteClick(category.id)}
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

            <UpsertCategoryModal
                isOpen={isExpectedModalOpen}
                onClose={() => setIsExpectedModalOpen(false)}
                categoryToEdit={editingCategory}
                allCategories={categories}
            />

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={deleteDialogOpen}
                onClose={() => {
                    setDeleteDialogOpen(false);
                    setCategoryToDelete(null);
                }}
                onConfirm={handleDelete}
                title="Delete Category"
                description="Are you sure you want to delete this category? This action cannot be undone."
                confirmText="Delete"
                variant="destructive"
            />
        </div>
    );
}
