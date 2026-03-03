import { ProductForm } from "../ProductForm";
import { getCategories } from "@/app/actions/categories";
import { getTags } from "@/app/actions/tags";

export default async function NewProductPage() {
    const [categories, tags] = await Promise.all([
        getCategories(),
        getTags()
    ]);

    return (
        <div>
            <ProductForm categories={categories} tags={tags} />
        </div>
    );
}
