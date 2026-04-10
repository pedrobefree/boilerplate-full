"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const router = useRouter();

    useEffect(() => {
        console.error("Dashboard Error Boundary caught:", error);
    }, [error]);

    return (
        <div className="flex w-full flex-col items-center justify-center py-24 text-center px-6">
            <div className="flex size-12 items-center justify-center rounded-full bg-error-100 mb-4">
                <AlertCircle className="size-6 text-error-600" />
            </div>
            <p className="text-sm font-semibold text-error-600">Ocorreu um erro no painel</p>
            <h1 className="mt-3 text-display-sm font-semibold text-gray-900">
                Algo deu errado
            </h1>
            <p className="mt-4 max-w-md text-lg text-gray-600">
                Lamentamos, mas ocorreu um erro inesperado ao carregar esta página. Por favor, tente novamente ou volte para o dashboard.
            </p>
            <div className="mt-8 flex w-full flex-col-reverse justify-center gap-3 sm:w-auto sm:flex-row">
                <Button
                    variant="secondary"
                    size="lg"
                    className="w-full sm:w-auto"
                    onPress={() => router.push('/dashboard')}
                >
                    Voltar ao Dashboard
                </Button>
                <Button 
                    variant="primary" 
                    size="lg" 
                    className="w-full sm:w-auto bg-error-600 hover:bg-error-700"
                    iconLeading={RefreshCw}
                    onPress={() => reset()}
                >
                    Tentar novamente
                </Button>
            </div>
        </div>
    );
}
