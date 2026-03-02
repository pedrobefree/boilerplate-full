"use client";

import { useState } from "react";
import { type ProductWithDetails } from "@/app/actions/products";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ShoppingBag, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductViewProps {
    product: ProductWithDetails;
}

export function ProductView({ product }: ProductViewProps) {
    const images = product.images?.length
        ? product.images.sort((a, b) => a.display_order - b.display_order).map(i => i.url)
        : [product.image].filter(Boolean) as string[];

    const [activeImage, setActiveImage] = useState(images[product.featured_image_index || 0] || images[0]);

    // Pricing Logic
    const mainPrice = product.prices?.find(p => p.active) || product.prices?.[0];
    const priceDisplay = mainPrice
        ? new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: mainPrice.currency.toUpperCase()
        }).format(mainPrice.unit_amount / 100)
        : "Free";

    const isRecurring = mainPrice?.type === 'recurring';
    const intervalDisplay = isRecurring ? `/${mainPrice.interval}` : "";

    const handleCheckout = () => {
        // Placeholder for checkout logic
        alert("Checkout flow to be implemented!");
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Gallery Section */}
            <div className="space-y-4">
                <div className="aspect-[4/3] bg-gray-100 rounded-2xl overflow-hidden border border-gray-200">
                    {activeImage ? (
                        <img
                            src={activeImage}
                            alt={product.name}
                            className="h-full w-full object-cover transition-all duration-300"
                        />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-300">
                            No Image
                        </div>
                    )}
                </div>

                {images.length > 1 && (
                    <div className="flex gap-4 overflow-x-auto pb-2">
                        {images.map((img, idx) => (
                            <button
                                key={idx}
                                onClick={() => setActiveImage(img)}
                                className={cn(
                                    "relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all",
                                    activeImage === img ? "border-brand-600 ring-2 ring-brand-100" : "border-transparent hover:border-gray-300"
                                )}
                            >
                                <img src={img} alt={`View ${idx + 1}`} className="h-full w-full object-cover" />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Details Section */}
            <div className="flex flex-col h-full space-y-6">
                <div>
                    <div className="flex items-center gap-3 mb-3">
                        {product.category && (
                            <Badge variant="brand">{product.category.name}</Badge>
                        )}
                        {product.tags?.map((item) => {
                            const tag = item.tags;
                            if (!tag) return null;
                            return (
                                <Badge
                                    key={tag.name}
                                    variant="secondary"
                                    style={tag.color ? { borderColor: tag.color, color: tag.color } : {}}
                                >
                                    {tag.name}
                                </Badge>
                            );
                        })}
                    </div>

                    <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">
                        {product.name}
                    </h1>

                    <div className="flex items-baseline gap-1 mb-6">
                        <span className="text-3xl font-bold text-gray-900">{priceDisplay}</span>
                        <span className="text-lg text-gray-500 font-medium">{intervalDisplay}</span>
                    </div>

                    <div className="prose prose-gray max-w-none text-gray-600">
                        <p>{product.description}</p>
                    </div>
                </div>

                <div className="border-t border-gray-100 pt-6 mt-auto space-y-4">
                    {/* Features / Highlights (Placeholder for now) */}
                    {/* <ul className="space-y-2">
                        <li className="flex items-center text-sm text-gray-600">
                            <Check className="w-4 h-4 text-green-500 mr-2" />
                            Premium Support
                        </li>
                     </ul> */}

                    <Button size="lg" className="w-full text-lg h-12" onPress={handleCheckout}>
                        <ShoppingBag className="w-5 h-5 mr-2" />
                        {isRecurring ? "Subscribe Now" : "Add to Cart"}
                    </Button>
                    <p className="text-xs text-center text-gray-500">
                        Secure checkout powered by Stripe
                    </p>
                </div>
            </div>
        </div>
    );
}
