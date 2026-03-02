"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getInvitationByToken, Invitation } from "@/app/actions/invitations";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { Building, Mail, Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface InvitePageProps {
    params: Promise<{ token: string }>;
}

export default function InvitePage({ params }: InvitePageProps) {
    const router = useRouter();
    const [invitation, setInvitation] = useState<Invitation | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadInvitation = async () => {
            try {
                const { token } = await params;
                const result = await getInvitationByToken(token);

                if (result.success && result.data) {
                    setInvitation(result.data);
                } else {
                    setError("This invitation is invalid or has expired.");
                }
            } catch (err) {
                setError("Failed to load invitation.");
            } finally {
                setIsLoading(false);
            }
        };

        loadInvitation();
    }, [params]);

    const handleAccept = async () => {
        if (!invitation) return;
        // Redirect to signup with invite token
        router.push(`/signup?invite=${invitation.token}`);
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="size-8 animate-spin text-brand-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="p-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-error-100 flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="size-8 text-error-600" />
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 mb-2">Invitation Invalid</h1>
                        <p className="text-gray-500 mb-6">{error}</p>
                        <Button onClick={() => router.push("/login")}>
                            Go to Login
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-gray-100 p-4">
            <Card className="max-w-md w-full shadow-xl">
                <CardContent className="p-8">
                    <div className="text-center mb-8">
                        <BrandLogo size="md" className="mx-auto mb-6" />
                        <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-4">
                            <Building className="size-8 text-brand-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">
                            You're Invited!
                        </h1>
                        <p className="text-gray-600">
                            You've been invited to join <span className="font-semibold text-gray-900">{invitation?.organization?.name || "a team"}</span>
                        </p>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <div className="flex items-center gap-3 text-sm">
                            <Mail className="size-4 text-gray-400" />
                            <span className="text-gray-600">Invitation sent to:</span>
                        </div>
                        <p className="font-medium text-gray-900 mt-1 ml-7">{invitation?.email}</p>

                        <div className="flex items-center gap-3 text-sm mt-3">
                            <CheckCircle className="size-4 text-success-500" />
                            <span className="text-gray-600">Role:</span>
                            <span className="capitalize font-medium text-gray-900">{invitation?.role}</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Button
                            className="w-full justify-center"
                            onClick={handleAccept}
                        >
                            Create Account & Join
                        </Button>
                        <p className="text-xs text-center text-gray-500">
                            Already have an account?{" "}
                            <a
                                href={`/login?invite=${invitation?.token}`}
                                className="text-brand-600 hover:text-brand-700 font-medium"
                            >
                                Log in instead
                            </a>
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
