import { ProjectsPage } from "@/components/features/projects/ProjectsPage";
import { getMyProjects } from "@/app/actions/projects";

export default async function Page() {
    const response = await getMyProjects();
    const projects = response.success ? response.data : [];

    return <ProjectsPage initialProjects={projects} />;
}
