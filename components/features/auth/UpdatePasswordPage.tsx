"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { UntitledUiLogo } from "@/components/ui/logos";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

function readTokensFromUrl() {
    if (typeof window === "undefined") {
        return { accessToken: null, refreshToken: null };
    }

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    return { accessToken, refreshToken };
}

export function UpdatePasswordPage() {
    const supabase = useMemo(() => createClient(), []);
    const router = useRouter();
    const { addToast } = useToast();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isReady, setIsReady] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        const establishRecoverySession = async () => {
            const { accessToken, refreshToken } = readTokensFromUrl();

            if (accessToken && refreshToken) {
                const { error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });

                if (error) {
                    router.push("/login?error=" + encodeURIComponent("Link de recuperação inválido ou expirado"));
                    return;
                }

                window.history.replaceState(null, "", window.location.pathname + window.location.search);
                setIsReady(true);
                return;
            }

            const { data } = await supabase.auth.getSession();
            if (data.session) {
                setIsReady(true);
                return;
            }

            router.push("/forgot-password?error=" + encodeURIComponent("Link de recuperação inválido ou expirado"));
        };

        void establishRecoverySession();
    }, [router, supabase]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (password.length < 8) {
            addToast({
                title: "Senha muito curta",
                description: "Use pelo menos 8 caracteres.",
                type: "error",
            });
            return;
        }

        if (password !== confirmPassword) {
            addToast({
                title: "As senhas não conferem",
                description: "Revise os campos e tente novamente.",
                type: "error",
            });
            return;
        }

        setIsSubmitting(true);

        const { error } = await supabase.auth.updateUser({ password });

        setIsSubmitting(false);

        if (error) {
            addToast({
                title: "Erro ao atualizar senha",
                description: error.message,
                type: "error",
            });
            return;
        }

        setIsSuccess(true);
        addToast({
            title: "Senha atualizada",
            description: "Sua nova senha já está ativa.",
            type: "success",
        });
    };

    if (isSuccess) {
        return (
            <div className="flex min-h-screen flex-col justify-center bg-gray-50 py-12 sm:px-6 lg:px-8">
                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <div className="flex justify-center">
                        <UntitledUiLogo className="h-10 w-auto" />
                    </div>
                    <div className="mt-8 bg-white py-8 px-4 shadow-sm sm:rounded-lg sm:px-10 text-center">
                        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-success-100">
                            <CheckCircle2 className="h-6 w-6 text-success-600" />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Senha criada com sucesso</h2>
                        <p className="mt-2 text-sm text-gray-600 mb-8">
                            Você já pode acessar a aplicação com a sua nova senha.
                        </p>
                        <Button className="w-full justify-center" onPress={() => router.push("/login")}>
                            Ir para login
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col justify-center bg-gray-50 py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center">
                    <UntitledUiLogo className="h-10 w-auto" />
                </div>
                <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">Definir nova senha</h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Escolha uma senha segura para concluir o acesso à sua conta.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-sm sm:rounded-lg sm:px-10">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <Input
                            label="Nova senha"
                            type="password"
                            placeholder="Use pelo menos 8 caracteres"
                            required
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            isDisabled={!isReady || isSubmitting}
                        />

                        <Input
                            label="Confirmar nova senha"
                            type="password"
                            placeholder="Repita a nova senha"
                            required
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            isDisabled={!isReady || isSubmitting}
                        />

                        <div>
                            <Button type="submit" className="w-full justify-center" isDisabled={!isReady || isSubmitting}>
                                {isSubmitting ? "Salvando..." : isReady ? "Salvar nova senha" : "Validando link..."}
                            </Button>
                        </div>
                    </form>

                    <div className="mt-6 flex justify-center">
                        <a href="/login" className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-500">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to log in
                        </a>
                    </div>

                    <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <div className="flex items-start gap-3 text-sm text-gray-600">
                            <KeyRound className="mt-0.5 h-4 w-4 text-brand-600" />
                            <p>Se o link expirar, volte ao fluxo de recuperação e solicite um novo email.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
