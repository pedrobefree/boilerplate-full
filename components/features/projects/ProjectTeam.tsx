"use client";

import { UserPlus, Mail, Settings, MoreHorizontal, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardContent } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useState, useEffect } from "react";
import { addProjectMember, removeProjectMember, updateProjectMemberRole } from "@/app/actions/projects";
import { getOrganizationMembers } from "@/app/actions/organizations";
import { useToast } from "@/components/ui/Toast";
import { useParams, useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface Member {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar: string;
    status: "active" | "invited";
}

export const ProjectTeam = ({ projectId, members = [] }: { projectId: string, members?: any[] }) => {
    const params = useParams();
    const router = useRouter();
    const { addToast } = useToast();
    const [orgMembers, setOrgMembers] = useState<any[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [selectedMemberId, setSelectedMemberId] = useState("");
    
    // Member deletion state
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        getOrganizationMembers().then(res => {
            if (res.success) setOrgMembers(res.data);
        });
    }, []);

    const handleAddMember = async () => {
        if (!selectedMemberId) return;
        setIsAdding(false);
        const res = await addProjectMember(projectId, selectedMemberId);
        if (res.success) {
            addToast({ title: "Success", description: "Member added to project", type: "success" });
            setSelectedMemberId("");
            router.refresh();
        } else {
            addToast({ title: "Error", description: res.error || "Failed to add member", type: "error" });
        }
    };

    const handleRemoveMember = async () => {
        if (!memberToDelete) return;
        setIsDeleting(true);
        const res = await removeProjectMember(projectId, memberToDelete);
        setIsDeleting(false);
        setDeleteConfirmOpen(false);
        setMemberToDelete(null);

        if (res.success) {
            addToast({ title: "Success", description: "Member removed from project", type: "success" });
            router.refresh();
        } else {
            addToast({ title: "Error", description: res.error || "Failed to remove member", type: "error" });
        }
    };

    const formattedMembers: Member[] = members.map(m => ({
        id: m.user_id,
        name: m.profile?.full_name || "Unknown",
        email: m.profile?.email || "-",
        role: m.role || "Member",
        avatar: m.profile?.avatar_url || "/api/placeholder/32/32",
        status: "active"
    }));

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Project Team</h2>
                    <p className="text-sm text-gray-500">Manage who has access to this project and their permissions.</p>
                </div>
                <div className="flex items-center gap-3">
                    {isAdding ? (
                        <div className="flex items-center gap-2">
                            <select
                                value={selectedMemberId}
                                onChange={(e) => setSelectedMemberId(e.target.value)}
                                className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                            >
                                <option value="">Select member...</option>
                                {orgMembers
                                    .filter(om => 
                                        !members.some(m => m.user_id === om.id) && 
                                        om.role !== "organization_member" // Filter out customers
                                    )
                                    .map(om => (
                                        <option key={om.id} value={om.id}>{om.full_name}</option>
                                    ))
                                }
                            </select>
                            <Button size="sm" onClick={handleAddMember} isDisabled={!selectedMemberId}>Add</Button>
                            <Button variant="tertiary" size="sm" onClick={() => setIsAdding(false)}>Cancel</Button>
                        </div>
                    ) : (
                        <>
                            <Button variant="secondary" size="sm" className="gap-2">
                                <Mail className="size-4" /> Share link
                            </Button>
                            <Button size="sm" className="gap-2" onClick={() => setIsAdding(true)}>
                                <UserPlus className="size-4" /> Add member
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Member</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {formattedMembers.length > 0 ? formattedMembers.map((member) => (
                                <TableRow key={member.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar src={member.avatar} alt={member.name} size="md" />
                                            <div className="flex flex-col text-left">
                                                <span className="text-sm font-semibold text-gray-900">{member.name}</span>
                                                <span className="text-xs text-gray-500">{member.email}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="default" size="sm" className="bg-gray-50 text-gray-600 border-gray-200">
                                                {member.role}
                                            </Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={member.status === "active" ? "success" : "default"} size="sm">
                                            {member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button 
                                                variant="tertiary" 
                                                size="sm" 
                                                className="p-2 text-error-600 hover:bg-error-50"
                                                onClick={() => {
                                                    setMemberToDelete(member.id);
                                                    setDeleteConfirmOpen(true);
                                                }}
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                                        No members assigned to this project yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <ConfirmDialog
                isOpen={deleteConfirmOpen}
                onClose={() => {
                    setDeleteConfirmOpen(false);
                    setMemberToDelete(null);
                }}
                onConfirm={handleRemoveMember}
                title="Remove Member"
                description="Are you sure you want to remove this member from the project? They will lose access to all tasks and files."
                isLoading={isDeleting}
                variant="destructive"
            />
        </div>
    );
};
