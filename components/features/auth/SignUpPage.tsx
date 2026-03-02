"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { UntitledUiLogo } from "@/components/ui/logos";
import { SocialIcon } from "@/components/ui/social-icons";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createOrganization } from "@/app/actions/organizations";
import { acceptInvitation, getInvitationByToken } from "@/app/actions/invitations";
import { useToast } from "@/components/ui/Toast";
import { Building, Loader2 } from "lucide-react";

export const SignUpPage = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const inviteToken = searchParams.get("invite");

    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingInvite, setIsLoadingInvite] = useState(!!inviteToken);
    const [error, setError] = useState<string | null>(null);
    const [inviteData, setInviteData] = useState<{
        email: string;
        orgName: string;
        role: string;
        logoUrl?: string | null;
    } | null>(null);
    const { addToast } = useToast();
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        password: "",
    });

    // Load invitation data if invite token is present
    useEffect(() => {
        if (inviteToken) {
            const loadInvite = async () => {
                try {
                    const result = await getInvitationByToken(inviteToken);
                    if (result.success && result.data) {
                        setInviteData({
                            email: result.data.email,
                            orgName: result.data.organization?.name || "a team",
                            role: result.data.role,
                            logoUrl: result.data.organization?.logo_url,
                        });
                        setFormData(prev => ({ ...prev, email: result.data!.email }));
                    } else {
                        setError("This invitation is invalid or has expired.");
                    }
                } catch (err) {
                    setError("Failed to load invitation.");
                } finally {
                    setIsLoadingInvite(false);
                }
            };
            loadInvite();
        }
    }, [inviteToken]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        const supabase = createClient();

        try {
            // 1. Sign up user
            const { data: authData, error: signUpError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.fullName,
                    },
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
            });

            if (signUpError) throw signUpError;

            if (authData.user) {
                if (inviteToken && inviteData) {
                    // Accept the invitation - adds user to the organization
                    const acceptResult = await acceptInvitation(inviteToken);

                    if (acceptResult.success) {
                        addToast({
                            title: "Welcome to " + inviteData.orgName + "!",
                            description: "Your account has been created and you've joined the team.",
                            type: "success",
                        });
                    } else {
                        // Still created account, but invitation acceptance failed
                        // Create a default org as fallback
                        const orgName = `${formData.fullName}'s Team`;
                        const orgSlug = formData.fullName.toLowerCase().replace(/\s+/g, '-') + '-' + Math.random().toString(36).substring(2, 7);
                        await createOrganization(orgName, orgSlug);

                        addToast({
                            title: "Account created!",
                            description: "There was an issue with the invitation, but your account is ready.",
                            type: "warning",
                        });
                    }
                } else {
                    // No invite - create a default organization for the new user
                    const orgName = `${formData.fullName}'s Team`;
                    const orgSlug = formData.fullName.toLowerCase().replace(/\s+/g, '-') + '-' + Math.random().toString(36).substring(2, 7);

                    await createOrganization(orgName, orgSlug);

                    addToast({
                        title: "Account created!",
                        description: "Your account and workspace are ready.",
                        type: "success",
                    });
                }

                router.push("/dashboard");
            }
        } catch (err: any) {
            const errorMessage = err.message || "Something went wrong. Please try again.";
            setError(errorMessage);
            addToast({
                title: "Sign up failed",
                description: errorMessage,
                type: "error",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSocialLogin = async (provider: 'google' | 'facebook' | 'twitter') => {
        const supabase = createClient();
        const redirectUrl = inviteToken
            ? `${window.location.origin}/auth/callback?invite=${inviteToken}`
            : `${window.location.origin}/auth/callback`;

        await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: redirectUrl,
            },
        });
    };

    if (isLoadingInvite) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <Loader2 className="size-8 animate-spin text-brand-600" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-white">
            {/* Left Section - Form */}
            <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
                <div className="mx-auto w-full max-w-sm lg:w-96">
                    <div>
                        <UntitledUiLogo className="h-8 w-auto text-brand-600" />

                        {inviteData ? (
                            <div className="flex flex-col items-center justify-center text-center">
                                {inviteData.logoUrl ? (
                                    <img
                                        src={inviteData.logoUrl}
                                        alt={inviteData.orgName}
                                        className="h-12 w-auto mb-6 rounded-lg shadow-sm"
                                    />
                                ) : (
                                    <div className="size-12 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold text-xl shadow-lg mb-6">
                                        {inviteData.orgName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                    </div>
                                )}
                                <h2 className="text-3xl font-bold tracking-tight text-gray-900 leading-tight">
                                    Join {inviteData.orgName}
                                </h2>
                                <div className="mt-4 flex items-center gap-2 px-4 py-2 bg-brand-50 rounded-full border border-brand-100">
                                    <Building className="size-4 text-brand-600" />
                                    <span className="text-sm font-medium text-brand-700">
                                        Invited as <span className="capitalize">{inviteData.role}</span>
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">Create an account</h2>
                                <p className="mt-2 text-sm text-gray-600">
                                    Already have an account?{" "}
                                    <a href="/login" className="font-medium text-brand-600 hover:text-brand-500">
                                        Log in
                                    </a>
                                </p>
                            </>
                        )}
                    </div>

                    <div className="mt-8">
                        <div className="mt-6">
                            {error && (
                                <div className="mb-4 rounded-md bg-red-50 p-4">
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} method="POST" className="space-y-6">
                                <Input
                                    label="Full name"
                                    name="fullName"
                                    type="text"
                                    placeholder="Enter your name"
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    required
                                />

                                <Input
                                    label="Email address"
                                    name="email"
                                    type="email"
                                    placeholder="Enter your email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    disabled={!!inviteData}
                                />

                                <Input
                                    label="Password"
                                    name="password"
                                    type="password"
                                    placeholder="Create a password"
                                    helperText="Must be at least 8 characters."
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                />

                                <div>
                                    <Button
                                        type="submit"
                                        className="w-full justify-center"
                                        isDisabled={isLoading}
                                    >
                                        {isLoading ? "Creating account..." : inviteData ? "Create Account & Join" : "Get started"}
                                    </Button>
                                </div>
                            </form>
                        </div>

                        <div className="mt-6">
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200" />
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="bg-white px-2 text-gray-500">Or sign up with</span>
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-3 gap-3">
                                <div>
                                    <Button variant="secondary" className="w-full justify-center" onClick={() => handleSocialLogin('google')}>
                                        <SocialIcon type="google" className="h-5 w-5" />
                                        <span className="sr-only">Sign up with Google</span>
                                    </Button>
                                </div>
                                <div>
                                    <Button variant="secondary" className="w-full justify-center" onClick={() => handleSocialLogin('facebook')}>
                                        <SocialIcon type="facebook" className="h-5 w-5" />
                                        <span className="sr-only">Sign up with Facebook</span>
                                    </Button>
                                </div>
                                <div>
                                    <Button variant="secondary" className="w-full justify-center" onClick={() => handleSocialLogin('twitter')}>
                                        <SocialIcon type="twitter" className="h-5 w-5" />
                                        <span className="sr-only">Sign up with Twitter</span>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Section - Image/Branding */}
            <div className="relative hidden w-0 flex-1 lg:block">
                <img
                    className="absolute inset-0 h-full w-full object-cover"
                    src="https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-1.2.1&auto=format&fit=crop&w=1567&q=80"
                    alt="Team background"
                />
                <div className="absolute inset-0 bg-gray-900/10 mix-blend-multiply" />
            </div>
        </div>
    );
};
