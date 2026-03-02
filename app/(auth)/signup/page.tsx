import { Suspense } from "react";
import { SignUpPage } from "@/components/features/auth/SignUpPage";

/**
 * Sign Up Route
 */
export default function Page() {
    return (
        <Suspense fallback={null}>
            <SignUpPage />
        </Suspense>
    );
}
