import { getProducts, type ProductSort } from "@/app/actions/products";
import { ProductCard } from "./ProductCard";
import { getCategories } from "@/app/actions/categories";
import { getTags } from "@/app/actions/tags";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchX } from "lucide-react";
import { ProductsFilters } from "./ProductsFilters";

export const metadata = {
    title: "Products | Befree Store",
    description: "Discover our premium products and subscriptions.",
};

const sortOptions = [
    { value: "relevance", label: "Relevance" },
    { value: "name-asc", label: "Name (A-Z)" },
    { value: "name-desc", label: "Name (Z-A)" },
    { value: "price-asc", label: "Price (Lowest)" },
    { value: "price-desc", label: "Price (Highest)" },
] as const;

type ProductsPageProps = {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function getSingleParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
    const resolvedParams = await searchParams;
    const q = (getSingleParam(resolvedParams.q) ?? "").trim();
    const category = getSingleParam(resolvedParams.category) ?? "";
    const tag = getSingleParam(resolvedParams.tag) ?? "";
    const sort = getSingleParam(resolvedParams.sort) ?? "relevance";
    const selectedSort: ProductSort = sortOptions.some((option) => option.value === sort)
        ? (sort as ProductSort)
        : "relevance";

    const [products, categories, tags] = await Promise.all([
        getProducts({
            search: q || undefined,
            categorySlug: category || undefined,
            tagId: tag || undefined,
            sort: selectedSort,
        }),
        getCategories(),
        getTags(),
    ]);

    const hasActiveFilters = Boolean(q || category || tag || sort !== "relevance");

    return (
        <div className="bg-gray-50 min-h-screen pb-20">
            <div className="bg-white border-b border-gray-200 pt-24 pb-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl tracking-tight mb-4">
                        Our Collection
                    </h1>
                    <p className="max-w-2xl mx-auto text-xl text-gray-500">
                        Explore our curated list of premium products and subscriptions designed for you.
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
                <ProductsFilters
                    categories={categories.map((item) => ({ id: item.slug, label: item.name }))}
                    tags={tags.map((item) => ({ id: item.id, label: item.name }))}
                    initialFilters={{ q, category, tag, sort: selectedSort }}
                />

                {products.length > 0 ? (
                    <div className="mt-12">
                        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {products.map((product) => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                        <p className="mt-6 text-right text-sm text-gray-400">
                            {products.length} product{products.length === 1 ? "" : "s"} found
                        </p>
                    </div>
                ) : (
                    <div className="mt-12 rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-16">
                        <EmptyState className="mx-auto">
                            <EmptyState.Header>
                                <EmptyState.Icon icon={SearchX} size="lg" color="gray" />
                            </EmptyState.Header>
                            <EmptyState.Content>
                                <EmptyState.Title>No products found</EmptyState.Title>
                                <EmptyState.Description>
                                    {hasActiveFilters
                                        ? "Try adjusting your search, category, tag, or sorting filters."
                                        : "We haven't added any products yet. Check back soon."}
                                </EmptyState.Description>
                            </EmptyState.Content>
                            {hasActiveFilters ? (
                                <EmptyState.Footer>
                                    <Link
                                        href="/products"
                                        className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
                                    >
                                        View full catalog
                                    </Link>
                                </EmptyState.Footer>
                            ) : null}
                        </EmptyState>
                    </div>
                )}
            </div>
        </div>
    );
}
