import { getCategories } from "@/app/actions/categories";
import { CategoryList } from "./CategoryList";

export default async function CategoriesPage() {
    const categories = await getCategories();

    return (
        <div>
            <CategoryList categories={categories} />
        </div>
    );
}
