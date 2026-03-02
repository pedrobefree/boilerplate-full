import { ProductForm } from "../ProductForm";
import { getCategories } from "@/app/actions/categories";
import { getTags } from "@/app/actions/tags";

export default async function NewProductPage() {
    const [categories, tags] = await Promise.all([
        getCategories(),
        getTags()
    ]);

    return (
        <div className="max-w-6xl mx-auto py-8">
            <ProductForm categories={categories} tags={tags} />
        </div>
    );
}
