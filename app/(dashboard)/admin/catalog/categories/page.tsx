import { getCategories } from "@/app/actions/categories";
import { CategoryList } from "./CategoryList";

export default async function CategoriesPage() {
    const categories = await getCategories();

    return (
        <div className="py-8">
            <CategoryList categories={categories} />
        </div>
    );
}
