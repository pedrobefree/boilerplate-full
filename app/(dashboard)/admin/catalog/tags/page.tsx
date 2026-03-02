import { getTags } from "@/app/actions/tags";
import { TagList } from "./TagList";

export default async function TagsPage() {
    const tags = await getTags();

    return (
        <div className="py-8">
            <TagList tags={tags} />
        </div>
    );
}
