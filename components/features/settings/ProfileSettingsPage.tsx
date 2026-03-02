"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/Textarea";
import { Label } from "@/components/ui/Label";
import { useAuth } from "@/components/features/auth/AuthProvider";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/Toast";

export default function ProfileSettingsPage() {
    const { user } = useAuth();
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [bio, setBio] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");

    // Load profile on mount
    useEffect(() => {
        async function loadProfile() {
            if (!user) return;

            try {
                // Dynamically import to avoid server-action issues if any, or just standard import
                const { getMyProfile } = await import("@/app/actions/profiles");
                const result = await getMyProfile();

                if (result.success && result.data) {
                    const profile = result.data;
                    const fullName = profile.full_name || "";
                    const [first, ...last] = fullName.split(" ");
                    setFirstName(first || "");
                    setLastName(last.join(" ") || "");
                    setBio(profile.bio || "");
                    setAvatarUrl(profile.avatar_url || "");
                } else {
                    // Fallback to user metadata if profile fetch fails or empty
                    const fullName = user.user_metadata?.full_name || "";
                    const [first, ...last] = fullName.split(" ");
                    setFirstName(first || "");
                    setLastName(last.join(" ") || "");
                    setAvatarUrl(user.user_metadata?.avatar_url || "");
                }
            } catch (e) {
                console.error("Error loading profile", e);
            }
        }
        loadProfile();
    }, [user]);

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const { updateMyProfile } = await import("@/app/actions/profiles");
            const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

            const result = await updateMyProfile({
                full_name: fullName,
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                bio: bio.trim(),
                avatar_url: avatarUrl.trim()
            });

            if (result.success) {
                addToast({
                    title: "Profile updated",
                    description: "Your changes have been saved successfully.",
                    type: "success"
                });
            } else {
                throw new Error(result.error);
            }
        } catch (error: any) {
            addToast({
                title: "Error updating profile",
                description: error.message || "Something went wrong.",
                type: "error"
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) return null;

    const initials = (firstName?.[0] || "U") + (lastName?.[0] || "");

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>Update your photo and personal details here.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Avatar Section */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                        <div className="h-12 w-12 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                            <Avatar
                                src={avatarUrl || user.user_metadata?.avatar_url}
                                alt={firstName}
                                size="md"
                                initials={initials.toUpperCase()}
                            />
                        </div>
                        <div className="space-y-2 flex-1">
                            <div className="space-y-2">
                                <Label htmlFor="avatarUrl">Avatar URL</Label>
                                <Input
                                    id="avatarUrl"
                                    value={avatarUrl}
                                    onChange={(e) => setAvatarUrl(e.target.value)}
                                    placeholder="https://example.com/avatar.jpg"
                                />
                                <p className="text-xs text-gray-500">Enter a direct link to an image (JPG, GIF or PNG).</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="firstName">First name</Label>
                            <Input
                                id="firstName"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="Jane"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="lastName">Last name</Label>
                            <Input
                                id="lastName"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder="Doe"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email address</Label>
                        <Input
                            id="email"
                            type="email"
                            defaultValue={user?.email || ""}
                            isDisabled
                            className="bg-gray-50 text-gray-500"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="bio">Bio</Label>
                        <TextArea
                            id="bio"
                            value={bio}
                            onChange={(value) => setBio(typeof value === 'string' ? value : (value as any).target.value)}
                            placeholder="Write a short introduction..."
                            rows={4}
                        />
                        <p className="text-xs text-gray-500">Brief description for your profile. URLs are hyperlinked.</p>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
                    <Button
                        onClick={handleSave}
                        isDisabled={isLoading}
                    >
                        {isLoading ? "Saving..." : "Save changes"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};
