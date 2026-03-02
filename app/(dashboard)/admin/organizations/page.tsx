"use client";

import { useEffect, useState } from "react";
import { getAllOrganizations, createOrganizationAdmin, deleteOrganizationAdmin, addUserToOrganizationAdmin, getOrganizationMembersAdmin } from "@/app/actions/admin";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table"; // Assuming these exist or use div based
import { useToast } from "@/components/ui/Toast";
import { Plus, Trash, UserPlus, Users, Eye, Pencil } from "lucide-react";
import { Dialog, Modal, ModalOverlay } from "@/components/ui/Modal";
import { EditOrganizationModal } from "@/components/features/admin/EditOrganizationModal";

// Helper components for table if not exist
const Th = ({ children }: { children: React.ReactNode }) => <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{children}</th>;
const Td = ({ children }: { children: React.ReactNode }) => <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{children}</td>;

export default function AdminOrganizationsPage() {
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();

    // Modal states
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [isMembersListOpen, setIsMembersListOpen] = useState(false);
    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
    const [orgMembers, setOrgMembers] = useState<any[]>([]);
    const [isMembersLoading, setIsMembersLoading] = useState(false);
    const [orgToEdit, setOrgToEdit] = useState<any>(null);

    const [formName, setFormName] = useState("");
    const [formSlug, setFormSlug] = useState("");
    const [formOwner, setFormOwner] = useState("");

    const [memberEmail, setMemberEmail] = useState("");
    const [memberRole, setMemberRole] = useState<"admin" | "member">("member");

    const fetchOrgs = async () => {
        try {
            const res = await getAllOrganizations();
            if (res.success) {
                setOrganizations(res.data);
            } else {
                addToast({ title: "Failed to load organizations", description: res.error, type: "error" });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOrgs();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await createOrganizationAdmin(formName, formSlug, formOwner);
        if (res.success) {
            addToast({ title: "Organization created", type: "success" });
            setIsCreateOpen(false);
            setFormName(""); setFormSlug(""); setFormOwner("");
            fetchOrgs();
        } else {
            addToast({ title: "Creation failed", description: res.error, type: "error" });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? This will delete the organization and all its data.")) return;
        const res = await deleteOrganizationAdmin(id);
        if (res.success) {
            addToast({ title: "Organization deleted", type: "success" });
            fetchOrgs();
        } else {
            addToast({ title: "Delete failed", description: res.error, type: "error" });
        }
    };

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOrgId) return;

        const res = await addUserToOrganizationAdmin(selectedOrgId, memberEmail, memberRole);
        if (res.success) {
            addToast({ title: "Member added", type: "success" });
            setIsAddMemberOpen(false);
            setMemberEmail("");
            // Should refresh? Member count might update
            fetchOrgs();
        } else {
            addToast({ title: "Failed to add member", description: res.error, type: "error" });
        }
    };

    const handleViewMembers = async (orgId: string) => {
        setSelectedOrgId(orgId);
        setIsMembersListOpen(true);
        setIsMembersLoading(true);
        try {
            const res = await getOrganizationMembersAdmin(orgId);
            if (res.success) {
                setOrgMembers(res.data);
            } else {
                addToast({ title: "Failed to load members", description: res.error, type: "error" });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsMembersLoading(false);
        }
    };

    if (isLoading) return <div className="p-8">Loading...</div>;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
                    <p className="text-sm text-gray-500">Manage all organizations (Super Admin)</p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> New Organization
                </Button>
            </div>

            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <Th>Name</Th>
                                <Th>Slug</Th>
                                <Th>Owner</Th>
                                <Th>Members</Th>
                                <Th>Created</Th>
                                <Th>Actions</Th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {organizations.map((org) => (
                                <tr key={org.id}>
                                    <Td>
                                        <span className="font-medium text-gray-900">{org.name}</span>
                                    </Td>
                                    <Td>{org.slug}</Td>
                                    <Td>
                                        <div className="flex flex-col">
                                            <span>{org.owner?.full_name || 'Unknown'}</span>
                                            <span className="text-xs text-gray-400">{org.owner?.email}</span>
                                        </div>
                                    </Td>
                                    <Td>{org.members?.[0]?.count || 0}</Td>
                                    <Td>{new Date(org.created_at).toLocaleDateString()}</Td>
                                    <Td>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedOrgId(org.id);
                                                    setIsAddMemberOpen(true);
                                                }}
                                            >
                                                <UserPlus className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => setOrgToEdit(org)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => handleViewMembers(org.id)}
                                            >
                                                <Users className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleDelete(org.id)}
                                            >
                                                <Trash className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </Td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Create Modal */}
            <ModalOverlay isOpen={isCreateOpen} onOpenChange={setIsCreateOpen} isDismissable>
                <Modal className="sm:max-w-md">
                    <Dialog className="outline-none">
                        <div className="p-6">
                            <h2 className="text-lg font-bold mb-4">Create Organization</h2>
                            <form onSubmit={handleCreate} className="space-y-4">
                                <Input label="Name" value={formName} onChange={(e) => setFormName(e.target.value)} required />
                                <Input label="Slug" value={formSlug} onChange={(e) => setFormSlug(e.target.value)} required />
                                <Input label="Owner Email" value={formOwner} onChange={(e) => setFormOwner(e.target.value)} required placeholder="user@example.com" />
                                <div className="flex justify-end gap-2 mt-4">
                                    <Button variant="secondary" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                                    <Button type="submit">Create</Button>
                                </div>
                            </form>
                        </div>
                    </Dialog>
                </Modal>
            </ModalOverlay>

            {/* Add Member Modal */}
            <ModalOverlay isOpen={isAddMemberOpen} onOpenChange={setIsAddMemberOpen} isDismissable>
                <Modal className="sm:max-w-md">
                    <Dialog className="outline-none">
                        <div className="p-6">
                            <h2 className="text-lg font-bold mb-4">Add User to Organization</h2>
                            <form onSubmit={handleAddMember} className="space-y-4">
                                <Input label="User Email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} required placeholder="user@example.com" />
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                    <select
                                        className="w-full rounded-md border border-gray-300 p-2"
                                        value={memberRole}
                                        onChange={(e) => setMemberRole(e.target.value as any)}
                                    >
                                        <option value="member">Member</option>
                                        <option value="admin">Admin</option>
                                        <option value="owner">Owner</option>
                                    </select>
                                </div>
                                <div className="flex justify-end gap-2 mt-4">
                                    <Button variant="secondary" onClick={() => setIsAddMemberOpen(false)}>Cancel</Button>
                                    <Button type="submit">Add User</Button>
                                </div>
                            </form>
                        </div>
                    </Dialog>
                </Modal>
            </ModalOverlay>

            {/* Members List Modal */}
            <ModalOverlay isOpen={isMembersListOpen} onOpenChange={setIsMembersListOpen} isDismissable>
                <Modal className="sm:max-w-xl">
                    <Dialog className="outline-none">
                        <div className="p-6">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Users className="h-5 w-5" /> Organization Members
                            </h2>

                            {isMembersLoading ? (
                                <div className="py-8 text-center text-gray-500">Loading members...</div>
                            ) : (
                                <div className="max-h-[60vh] overflow-y-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <Th>User</Th>
                                                <Th>Role</Th>
                                                <Th>Joined</Th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {orgMembers.map((m) => (
                                                <tr key={m.id}>
                                                    <Td>
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-gray-900">{m.profile?.full_name || 'No Name'}</span>
                                                            <span className="text-xs text-gray-400">{m.profile?.email}</span>
                                                        </div>
                                                    </Td>
                                                    <Td>
                                                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 capitalize">
                                                            {m.role}
                                                        </span>
                                                    </Td>
                                                    <Td>{new Date(m.created_at).toLocaleDateString()}</Td>
                                                </tr>
                                            ))}
                                            {orgMembers.length === 0 && (
                                                <tr>
                                                    <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                                                        No members found.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="flex justify-end mt-6">
                                <Button variant="secondary" onClick={() => setIsMembersListOpen(false)}>Close</Button>
                            </div>
                        </div>
                    </Dialog>
                </Modal>
            </ModalOverlay>

            <EditOrganizationModal
                isOpen={!!orgToEdit}
                onClose={() => setOrgToEdit(null)}
                organization={orgToEdit}
                onSuccess={fetchOrgs}
            />
        </div>
    );
}
