"use client";

import Link from "next/link";
import { type ProductWithDetails } from "@/app/actions/products";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface ProductCardProps {
    product: ProductWithDetails;
}

export function ProductCard({ product }: ProductCardProps) {
    const mainPrice = product.prices?.find(p => p.active) || product.prices?.[0];

    // Format price
    const priceDisplay = mainPrice
        ? new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: mainPrice.currency.toUpperCase()
        }).format((mainPrice.unit_amount || 0) / 100)
        : "Free";

    const intervalDisplay = mainPrice?.interval ? `/${mainPrice.interval}` : "";

    return (
        <Link
            href={`/products/${product.id}`}
            className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-xl hover:border-brand-200 transition-all duration-300"
        >
            <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
                {product.image ? (
                    <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-300">
                        No Image
                    </div>
                )}

                {product.category && (
                    <div className="absolute top-3 left-3">
                        <span className="bg-white/90 backdrop-blur-sm text-xs font-semibold px-2.5 py-1 rounded-full text-gray-800 shadow-sm">
                            {product.category.name}
                        </span>
                    </div>
                )}
            </div>

            <div className="p-5 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg text-gray-900 group-hover:text-brand-600 transition-colors line-clamp-1">
                        {product.name}
                    </h3>
                </div>

                <p className="text-gray-500 text-sm line-clamp-2 mb-4 flex-1">
                    {product.description || "No description available."}
                </p>

                <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">Starting at</span>
                        <div className="flex items-baseline">
                            <span className="text-xl font-bold text-gray-900">{priceDisplay}</span>
                            <span className="text-sm text-gray-500 font-medium ml-1">{intervalDisplay}</span>
                        </div>
                    </div>
                    <Button size="sm" variant="secondary" className="group-hover:bg-brand-600 group-hover:text-white transition-colors">
                        View
                    </Button>
                </div>
            </div>
        </Link>
    );
}
