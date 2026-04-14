import { getProjectBySlug } from "@/app/actions/projects";
import { ProjectDetails } from "@/components/features/projects/ProjectDetails";
import { notFound } from "next/navigation";

interface PageProps {
    params: Promise<{ slug: string }>;
}

export default async function ProjectPage({ params }: PageProps) {
    const { slug } = await params;
    const response = await getProjectBySlug(slug);

    if (!response.success || !response.data) {
        return notFound();
    }

    const project = response.data;

    // Map backend data to UI model expected by ProjectDetails
    const mappedProject = {
        id: project.id,
        name: project.name,
        description: project.description || "",
        status: project.status || "active",
        progress: project.taskStats?.progress || 0,
        team: project.members ? project.members.map((m: any) => m.profile?.avatar_url || "/api/placeholder/32/32") : [],
        category: "General",
        taskStats: project.taskStats,
        members: project.members
    };

    return (
        <ProjectDetails 
            project={mappedProject} 
            // onBack will be handled differently or we can just use a link in ProjectDetails
        />
    );
}
