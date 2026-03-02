"use client";

import { useState, useEffect } from "react";
import { useOrganization } from "@/app/context/OrganizationContext";
import { updateOrganizationDetails } from "@/app/actions/organizations";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Settings, Shield, Clock, Building } from "lucide-react";

export const OrganizationSettingsPage = () => {
    const { currentOrganization, refreshOrganizations } = useOrganization();
    const { addToast } = useToast();

    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [expiration, setExpiration] = useState(7);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (currentOrganization) {
            setName(currentOrganization.name);
            setSlug(currentOrganization.slug || "");
            // expiration from DB might be missing if not updated yet
            // @ts-ignore - expiration column was just added
            setExpiration(currentOrganization.invite_expiration_days || 7);
        }
    }, [currentOrganization]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentOrganization) return;

        setIsLoading(true);
        try {
            const result = await updateOrganizationDetails({
                name,
                slug,
                invite_expiration_days: Number(expiration)
            });

            if (result.success) {
                addToast({ title: "Settings updated", type: "success" });
                await refreshOrganizations();
            } else {
                addToast({ title: "Failed to update", description: result.error, type: "error" });
            }
        } catch (error) {
            addToast({ title: "Error updating settings", type: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    if (!currentOrganization) {
        return (
            <div className="flex items-center justify-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <p className="text-gray-500 font-medium">Select an organization to manage settings.</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Organization Settings</h1>
                <p className="text-gray-500 mt-1">
                    Manage your organization's identity and global configurations.
                </p>
            </header>

            <form onSubmit={handleSave} className="space-y-6">
                <Card className="overflow-hidden border-gray-200 shadow-sm">
                    <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-6 flex flex-row items-center gap-3">
                        <div className="p-2 bg-brand-100 rounded-lg">
                            <Building className="size-5 text-brand-700" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">General Information</h2>
                            <p className="text-sm text-gray-500">Update your organization's public name and identifier.</p>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <div className="grid gap-6 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="org-name">Organization Name</Label>
                                <Input
                                    id="org-name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Acme Corp"
                                    required
                                />
                                <p className="text-xs text-gray-400 font-normal mt-1 flex items-center gap-1">
                                    <Shield className="size-3" /> Seen by all members
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="org-slug">Slug (URL Segment)</Label>
                                <Input
                                    id="org-slug"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value)}
                                    placeholder="acme-corp"
                                    required
                                />
                                <p className="text-xs text-gray-500 italic">
                                    example.com/org/{" "}
                                    <span className="font-semibold text-brand-600">
                                        {slug || "your-slug"}
                                    </span>
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="overflow-hidden border-gray-200 shadow-sm">
                    <CardHeader className="bg-gray-50/50 border-b border-gray-100 p-6 flex flex-row items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <Clock className="size-5 text-amber-700" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Invite Settings</h2>
                            <p className="text-sm text-gray-500">Configure how invitations behave in your organization.</p>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="space-y-4">
                            <div className="max-w-xs space-y-2">
                                <Label htmlFor="invite-expiry">Invite Expiration (Days)</Label>
                                <div className="flex items-center gap-3">
                                    <Input
                                        id="invite-expiry"
                                        type="number"
                                        min="1"
                                        max="365"
                                        value={expiration}
                                        onChange={(e) => setExpiration(parseInt(e.target.value))}
                                        className="w-24"
                                    />
                                    <span className="text-sm text-gray-500 font-medium">Days</span>
                                </div>
                                <p className="text-xs text-gray-400">
                                    Tokens will be invalid after this period. Default is 7 days.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end pt-2">
                    <Button
                        type="submit"
                        isDisabled={isLoading}
                        className="min-w-[120px] shadow-lg shadow-brand-500/20"
                    >
                        {isLoading ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </form>
        </div>
    );
};
