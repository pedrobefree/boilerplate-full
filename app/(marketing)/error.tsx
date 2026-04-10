"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function MarketingError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const router = useRouter();

    useEffect(() => {
        console.error("Marketing Error Boundary caught:", error);
    }, [error]);

    return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-24 text-center bg-white">
            <div className="flex size-12 items-center justify-center rounded-full bg-error-100 mb-4">
                <AlertCircle className="size-6 text-error-600" />
            </div>
            <p className="text-sm font-semibold text-error-600">Ocorreu um erro</p>
            <h1 className="mt-3 text-display-sm font-semibold text-gray-900">
                Algo deu errado
            </h1>
            <p className="mt-4 max-w-md text-lg text-gray-600">
                Lamentamos, mas ocorreu um erro inesperado. Por favor, tente novamente ou volte para a página inicial.
            </p>
            <div className="mt-8 flex w-full flex-col-reverse justify-center gap-3 sm:w-auto sm:flex-row">
                <Button
                    variant="secondary"
                    size="lg"
                    className="w-full sm:w-auto"
                    onPress={() => router.push('/')}
                >
                    Voltar ao início
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
