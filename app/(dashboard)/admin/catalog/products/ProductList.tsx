"use client";

import { useState, useMemo } from "react";
import { type ProductWithDetails, deleteProduct } from "@/app/actions/products";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Plus, Pencil, Trash2, X, SlidersHorizontal, ChevronUp, ChevronDown } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import Link from "next/link";
import { Select } from "@/components/ui/Select";
import { SelectItem } from "@/components/ui/SelectItem";
import { Checkbox } from "@/components/ui/Checkbox";
import { FilterSheet } from "@/components/ui/FilterSheet";
import { ClientOnly } from "@/components/ui/ClientOnly";
import { PaginationSimple } from "@/components/ui/Pagination";

interface ProductListProps {
    products: ProductWithDetails[];
}

type SortField = "name" | "category" | "price" | "status";
type SortDirection = "asc" | "desc";

export function ProductList({ products }: ProductListProps) {
    const { addToast } = useToast();

    // Filter state
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [priceTypeFilter, setPriceTypeFilter] = useState<string>("all");

    // Sort state
    const [sortField, setSortField] = useState<SortField>("name");
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

    // Pagination state
    const [page, setPage] = useState(1);
    const pageSize = 10;

    // Delete confirmation state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [productToDelete, setProductToDelete] = useState<string | null>(null);

    // Extract unique categories and tags for filter options
    const uniqueCategories = useMemo(() => {
        const cats = products.filter(p => p.category).map(p => p.category!);
        return Array.from(new Map(cats.map(c => [c.name, c])).values());
    }, [products]);

    const uniqueTags = useMemo(() => {
        const allTags: { id: string; name: string; color: string | null }[] = [];
        products.forEach(p => {
            p.tags?.forEach(t => {
                if (!allTags.find(at => at.id === t.tag_id)) {
                    allTags.push({ id: t.tag_id, name: t.tags.name, color: t.tags.color });
                }
            });
        });
        return allTags;
    }, [products]);

    // Handle sort
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection("asc");
        }
    };

    // Filtered and sorted products
    const filteredProducts = useMemo(() => {
        let result = [...products];

        if (categoryFilter !== "all") {
            result = result.filter(p => p.category?.name === categoryFilter);
        }

        if (selectedTags.length > 0) {
            result = result.filter(p => p.tags?.some(t => selectedTags.includes(t.tag_id)));
        }

        if (priceTypeFilter !== "all") {
            result = result.filter(p => {
                const mainPrice = p.prices?.find(pr => pr.active) || p.prices?.[0];
                if (!mainPrice) return priceTypeFilter === "none";
                return mainPrice.type === priceTypeFilter;
            });
        }

        // Sort
        result.sort((a, b) => {
            let comparison = 0;

            switch (sortField) {
                case "name":
                    comparison = a.name.localeCompare(b.name);
                    break;
                case "category":
                    comparison = (a.category?.name || "").localeCompare(b.category?.name || "");
                    break;
                case "price":
                    const priceA = a.prices?.find(p => p.active)?.unit_amount || 0;
                    const priceB = b.prices?.find(p => p.active)?.unit_amount || 0;
                    comparison = priceA - priceB;
                    break;
                case "status":
                    comparison = (a.active ? 1 : 0) - (b.active ? 1 : 0);
                    break;
            }

            return sortDirection === "asc" ? comparison : -comparison;
        });

        return result;
    }, [products, categoryFilter, selectedTags, priceTypeFilter, sortField, sortDirection]);

    // Paginated products
    const paginatedProducts = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredProducts.slice(start, start + pageSize);
    }, [filteredProducts, page]);

    const totalPages = Math.ceil(filteredProducts.length / pageSize);

    const handleDeleteClick = (id: string) => {
        setProductToDelete(id);
        setDeleteDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!productToDelete) return;

        const res = await deleteProduct(productToDelete);
        if (res.error) {
            addToast({ title: "Error", description: res.error, type: "error" });
        } else {
            addToast({ title: "Success", description: "Product deleted", type: "success" });
        }

        setDeleteDialogOpen(false);
        setProductToDelete(null);
    };

    const formatPrice = (prices: any[]) => {
        if (!prices || prices.length === 0) return "-";
        const mainPrice = prices.find(p => p.active) || prices[0];
        if (!mainPrice.unit_amount) return "Free";

        const amount = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: mainPrice.currency.toUpperCase()
        }).format(mainPrice.unit_amount / 100);

        return `${amount}${mainPrice.interval ? ` /${mainPrice.interval}` : ''}`;
    };

    const hasActiveFilters = categoryFilter !== "all" || selectedTags.length > 0 || priceTypeFilter !== "all";
    const activeFilterCount = (categoryFilter !== "all" ? 1 : 0) + selectedTags.length + (priceTypeFilter !== "all" ? 1 : 0);

    const clearFilters = () => {
        setCategoryFilter("all");
        setSelectedTags([]);
        setPriceTypeFilter("all");
        setPage(1);
    };

    // Sortable header component
    const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
        <th
            className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest cursor-pointer hover:bg-gray-100 transition-colors select-none"
            onClick={() => handleSort(field)}
        >
            <div className="flex items-center gap-1">
                {children}
                {sortField === field && (
                    sortDirection === "asc"
                        ? <ChevronUp className="size-3.5" />
                        : <ChevronDown className="size-3.5" />
                )}
            </div>
        </th>
    );

    // Filter content for the sheet
    const filterContent = (
        <div className="space-y-6">
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Category</label>
                <Select
                    selectedKey={categoryFilter}
                    onSelectionChange={(k) => setCategoryFilter(k as string)}
                    placeholder="All Categories"
                >
                    <SelectItem id="all">All Categories</SelectItem>
                    {uniqueCategories.map(cat => (
                        <SelectItem id={cat.name} key={cat.name}>{cat.name}</SelectItem>
                    ))}
                </Select>
            </div>

            <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">Tags</label>
                <div className="space-y-2">
                    {uniqueTags.map(tag => (
                        <label key={tag.id} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                                isSelected={selectedTags.includes(tag.id)}
                                onChange={(checked) => {
                                    if (checked) {
                                        setSelectedTags([...selectedTags, tag.id]);
                                    } else {
                                        setSelectedTags(selectedTags.filter(t => t !== tag.id));
                                    }
                                }}
                            />
                            <Badge
                                variant="default"
                                size="sm"
                                className="cursor-pointer"
                                style={tag.color ? {
                                    backgroundColor: `${tag.color}20`,
                                    color: tag.color,
                                    borderColor: `${tag.color}40`
                                } : undefined}
                            >
                                {tag.name}
                            </Badge>
                        </label>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Price Type</label>
                <Select
                    selectedKey={priceTypeFilter}
                    onSelectionChange={(k) => setPriceTypeFilter(k as string)}
                    placeholder="All Types"
                >
                    <SelectItem id="all">All Types</SelectItem>
                    <SelectItem id="one_time">One-time</SelectItem>
                    <SelectItem id="recurring">Recurring</SelectItem>
                    <SelectItem id="none">No Price</SelectItem>
                </Select>
            </div>
        </div>
    );

    // Filter chip
    const FilterChip = ({ label, onRemove, color }: { label: string; onRemove: () => void; color?: string | null }) => (
        <button
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            style={color ? {
                backgroundColor: `${color}20`,
                color: color,
                borderColor: `${color}40`
            } : undefined}
        >
            {label}
            <X className="w-3.5 h-3.5" style={color ? { color } : undefined} />
        </button>
    );

    return (
        <ClientOnly fallback={<div className="space-y-4 animate-pulse"><div className="h-10 bg-gray-100 rounded" /><div className="h-96 bg-gray-100 rounded-xl" /></div>}>
            <div className="space-y-6">
                {/* Page Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Products</h2>
                        <p className="text-sm text-gray-500">Manage your product catalog</p>
                    </div>
                    <Link href="/admin/catalog/products/new">
                        <Button className="gap-2">
                            <Plus className="size-4" />
                            Add Product
                        </Button>
                    </Link>
                </div>

                {/* Table Card */}
                <Card>
                    <CardHeader className="flex-row items-start justify-between">
                        <div>
                            <CardTitle className="text-lg">All Products</CardTitle>
                            <CardDescription>
                                {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""} in your catalog
                            </CardDescription>
                        </div>
                        <FilterSheet
                            trigger={
                                <Button variant="secondary" className="gap-2 h-10">
                                    <SlidersHorizontal className="size-4" />
                                    Filters
                                    {activeFilterCount > 0 && (
                                        <Badge variant="brand" size="sm">
                                            {activeFilterCount}
                                        </Badge>
                                    )}
                                </Button>
                            }
                            onClearAll={clearFilters}
                        >
                            {filterContent}
                        </FilterSheet>
                    </CardHeader>

                    {/* Active Filters */}
                    {hasActiveFilters && (
                        <div className="flex flex-wrap items-center gap-2 px-6 py-3 bg-gray-50 border-y border-gray-100">
                            {categoryFilter !== "all" && (
                                <FilterChip label={categoryFilter} onRemove={() => setCategoryFilter("all")} />
                            )}
                            {selectedTags.map(tagId => {
                                const tag = uniqueTags.find(t => t.id === tagId);
                                return tag ? (
                                    <FilterChip
                                        key={tagId}
                                        label={tag.name}
                                        color={tag.color}
                                        onRemove={() => setSelectedTags(selectedTags.filter(t => t !== tagId))}
                                    />
                                ) : null;
                            })}
                            {priceTypeFilter !== "all" && (
                                <FilterChip
                                    label={priceTypeFilter === "one_time" ? "One-time" : priceTypeFilter === "recurring" ? "Recurring" : "No Price"}
                                    onRemove={() => setPriceTypeFilter("all")}
                                />
                            )}
                            <Button variant="tertiary" size="sm" onPress={clearFilters}>
                                Clear all
                            </Button>
                        </div>
                    )}

                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-y border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Image</th>
                                        <SortableHeader field="name">Name</SortableHeader>
                                        <SortableHeader field="category">Category</SortableHeader>
                                        <SortableHeader field="price">Price</SortableHeader>
                                        <SortableHeader field="status">Status</SortableHeader>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {paginatedProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                                {hasActiveFilters ? "No products match your filters." : "No products found. Create one to get started."}
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedProducts.map((product) => (
                                            <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                                                        {product.image ? (
                                                            <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">No Img</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-semibold text-gray-900">{product.name}</div>
                                                    {product.description && (
                                                        <div className="text-sm text-gray-500 truncate max-w-xs">{product.description}</div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {product.category ? (
                                                        <Badge variant="default" size="sm">{product.category.name}</Badge>
                                                    ) : (
                                                        <span className="text-gray-400 text-sm">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm font-medium text-gray-700">
                                                    {formatPrice(product.prices || [])}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant={product.active ? "success" : "default"}>
                                                        {product.active ? "Active" : "Archived"}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-right space-x-2">
                                                    <Link href={`/admin/catalog/products/${product.id}`}>
                                                        <Button variant="tertiary" size="sm">
                                                            <Pencil className="size-4" />
                                                        </Button>
                                                    </Link>
                                                    <Button variant="tertiary" size="sm" onPress={() => handleDeleteClick(product.id)} className="text-error-600 hover:text-error-700">
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="px-6 py-4 border-t border-gray-100">
                                <PaginationSimple
                                    page={page}
                                    total={totalPages}
                                    onPageChange={setPage}
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Delete Confirmation Dialog */}
                <ConfirmDialog
                    isOpen={deleteDialogOpen}
                    onClose={() => {
                        setDeleteDialogOpen(false);
                        setProductToDelete(null);
                    }}
                    onConfirm={handleDelete}
                    title="Delete Product"
                    description="Are you sure you want to delete this product? This action cannot be undone."
                    confirmText="Delete"
                    variant="destructive"
                />
            </div>
        </ClientOnly>
    );
}
