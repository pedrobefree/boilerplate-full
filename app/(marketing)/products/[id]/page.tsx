import { getProduct } from "@/app/actions/products";
import { ProductView } from "../ProductView";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const product = await getProduct(id);
    if (!product) return { title: "Product Not Found" };
    return {
        title: `${product.name} | Befree Store`,
        description: product.description,
    };
}

export default async function ProductDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const product = await getProduct(id);

    if (!product) {
        notFound();
    }

    return (
        <div className="bg-white min-h-screen pb-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 md:pt-12">
                <div className="mb-8">
                    <Link href="/products">
                        <Button variant="tertiary" size="sm" className="pl-0 hover:bg-transparent hover:text-brand-600">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Products
                        </Button>
                    </Link>
                </div>

                <ProductView product={product} />
            </div>
        </div>
    );
}
