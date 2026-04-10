"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FilterSheet } from "@/components/ui/FilterSheet";

type FilterOption = {
    id: string;
    label: string;
};

type ProductFiltersProps = {
    categories: FilterOption[];
    tags: FilterOption[];
    initialFilters: {
        q: string;
        category: string;
        tag: string;
        sort: string;
    };
};

const sortOptions = [
    { id: "relevance", label: "Relevance" },
    { id: "name-asc", label: "Name (A-Z)" },
    { id: "name-desc", label: "Name (Z-A)" },
    { id: "price-asc", label: "Price (Lowest)" },
    { id: "price-desc", label: "Price (Highest)" },
];

export function ProductsFilters({ categories, tags, initialFilters }: ProductFiltersProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [searchQuery, setSearchQuery] = useState(initialFilters.q);
    const [categoryFilter, setCategoryFilter] = useState(initialFilters.category || "all");
    const [tagFilter, setTagFilter] = useState(initialFilters.tag || "all");
    const [sortFilter, setSortFilter] = useState(initialFilters.sort || "relevance");

    const updateFilters = (updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString());

        Object.entries(updates).forEach(([key, value]) => {
            if (value === null || value === "" || value === "all" || value === "relevance") {
                params.delete(key);
            } else {
                params.set(key, value);
            }
        });

        const nextQuery = params.toString();
        router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    };

    const clearFilters = () => {
        setSearchQuery("");
        setCategoryFilter("all");
        setTagFilter("all");
        setSortFilter("relevance");
        router.push(pathname);
    };

    const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        updateFilters({
            q: searchQuery,
            category: categoryFilter,
        });
    };

    const handleApplyFilters = () => {
        updateFilters({
            q: searchQuery,
            category: categoryFilter,
            tag: tagFilter,
            sort: sortFilter,
        });
    };

    const currentCategory = categories.find((item) => item.id === initialFilters.category);
    const currentTag = tags.find((item) => item.id === initialFilters.tag);
    const currentSort = sortOptions.find((item) => item.id === initialFilters.sort);
    const hasActiveFilters = Boolean(
        initialFilters.q ||
        (initialFilters.category && initialFilters.category !== "all") ||
        (initialFilters.tag && initialFilters.tag !== "all") ||
        (initialFilters.sort && initialFilters.sort !== "relevance")
    );

    const FilterChip = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
        <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
        >
            {label}
            <X className="size-3.5" />
        </button>
    );

    const filterContent = (
        <div className="space-y-6">
            <div className="space-y-2">
                <label htmlFor="product-tag-filter" className="text-sm font-medium text-gray-700">
                    Tag
                </label>
                <select
                    id="product-tag-filter"
                    value={tagFilter}
                    onChange={(event) => setTagFilter(event.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                    <option value="all">All Tags</option>
                    {tags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                            {tag.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="space-y-2">
                <label htmlFor="product-sort-filter" className="text-sm font-medium text-gray-700">
                    Sort by
                </label>
                <select
                    id="product-sort-filter"
                    value={sortFilter}
                    onChange={(event) => setSortFilter(event.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-4 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                    {sortOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row">
                <form onSubmit={handleSearch} className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                        aria-label="Search products"
                    />
                </form>

                <div className="flex gap-2">
                    <select
                        value={categoryFilter}
                        onChange={(event) => {
                            const value = event.target.value;
                            setCategoryFilter(value);
                            updateFilters({
                                q: searchQuery,
                                category: value,
                            });
                        }}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                        aria-label="Filter by category"
                    >
                        <option value="all">All Categories</option>
                        {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                                {category.label}
                            </option>
                        ))}
                    </select>

                    <FilterSheet
                        trigger={
                            <Button variant="secondary" className="gap-2 shrink-0">
                                <SlidersHorizontal className="size-4" />
                                More Filters
                            </Button>
                        }
                        onClearAll={clearFilters}
                        onApply={handleApplyFilters}
                    >
                        {filterContent}
                    </FilterSheet>
                </div>
            </div>

            {hasActiveFilters ? (
                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-end">
                        <Button variant="tertiary" size="sm" onPress={clearFilters}>
                            Clear all
                        </Button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                        {initialFilters.q ? (
                            <FilterChip
                                label={`Search: ${initialFilters.q}`}
                                onRemove={() => {
                                    setSearchQuery("");
                                    updateFilters({ q: null });
                                }}
                            />
                        ) : null}
                        {currentCategory ? (
                            <FilterChip
                                label={`Category: ${currentCategory.label}`}
                                onRemove={() => {
                                    setCategoryFilter("all");
                                    updateFilters({ category: null });
                                }}
                            />
                        ) : null}
                        {currentTag ? (
                            <FilterChip
                                label={`Tag: ${currentTag.label}`}
                                onRemove={() => {
                                    setTagFilter("all");
                                    updateFilters({ tag: null });
                                }}
                            />
                        ) : null}
                        {currentSort ? (
                            <FilterChip
                                label={`Sort: ${currentSort.label}`}
                                onRemove={() => {
                                    setSortFilter("relevance");
                                    updateFilters({ sort: null });
                                }}
                            />
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
