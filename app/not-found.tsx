"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
    const router = useRouter();

    return (
        <div className="flex min-h-[100vh] flex-col items-center justify-center bg-white px-6 py-24 text-center">
            <p className="text-sm font-semibold text-brand-600">404 error</p>
            <h1 className="mt-3 text-display-sm font-semibold text-gray-900 sm:text-display-md">
                We can&apos;t find that page
            </h1>
            <p className="mt-4 max-w-md text-lg text-gray-600">
                Sorry, the page you are looking for doesn&apos;t exist or has been moved.
            </p>
            <div className="mt-8 flex w-full flex-col-reverse justify-center gap-3 sm:w-auto sm:flex-row">
                <Button
                    variant="secondary"
                    size="lg"
                    className="w-full sm:w-auto"
                    iconLeading={ArrowLeft}
                    onPress={() => window.history.back()}
                >
                    Go back
                </Button>
                <Button 
                    variant="primary" 
                    size="lg" 
                    className="w-full sm:w-auto"
                    onPress={() => router.push('/')}
                >
                    Take me home
                </Button>
            </div>
        </div>
    );
}
