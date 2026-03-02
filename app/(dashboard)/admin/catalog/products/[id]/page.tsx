import { ProductForm } from "../ProductForm";
import { getCategories } from "@/app/actions/categories";
import { getTags } from "@/app/actions/tags";
import { getProduct } from "@/app/actions/products";
import { notFound } from "next/navigation";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    console.log("EditProductPage params id:", id);

    const [categories, tags, product] = await Promise.all([
        getCategories(),
        getTags(),
        getProduct(id)
    ]);
    console.log("EditProductPage product result:", product ? "Found" : "Not Found");

    if (!product) {
        notFound();
    }

    return (
        <div className="max-w-6xl py-8">
            <ProductForm
                categories={categories}
                tags={tags}
                initialData={product}
            />
        </div>
    );
}
