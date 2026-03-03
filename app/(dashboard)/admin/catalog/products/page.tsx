import { getProducts } from "@/app/actions/products";
import { ProductList } from "./ProductList";

export default async function ProductsPage() {
    const products = await getProducts();

    return (
        <div>
            <ProductList products={products} />
        </div>
    );
}
