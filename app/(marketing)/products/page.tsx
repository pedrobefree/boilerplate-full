import { getProducts } from "@/app/actions/products";
import { ProductCard } from "./ProductCard";
import { getCategories } from "@/app/actions/categories";
import { getTags } from "@/app/actions/tags";

export const metadata = {
    title: "Products | Befree Store",
    description: "Discover our premium products and subscriptions.",
};

export default async function ProductsPage() {
    // Fetch products
    const products = await getProducts();

    // For now, filter out inactive ones strictly just in case action returns them
    const activeProducts = products.filter(p => p.active !== false);

    return (
        <div className="bg-gray-50 min-h-screen pb-20">
            {/* Header Section */}
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

            {/* Content Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
                {activeProducts.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {activeProducts.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="bg-gray-100 p-6 rounded-full mb-4">
                            <span className="text-4xl">🛍️</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No products found</h3>
                        <p className="text-gray-500 max-w-md">
                            We haven't added any products yet. Check back soon!
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
