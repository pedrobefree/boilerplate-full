"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/app/context/CartContext";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { Suspense } from "react";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function CheckoutSuccessContent() {
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("");
    const { clearCart } = useCart();

    useEffect(() => {
        const checkStatus = async () => {
            const clientSecret = searchParams.get("payment_intent_client_secret");

            if (!clientSecret) {
                setStatus("error");
                setMessage("Invalid payment session.");
                return;
            }

            const stripe = await stripePromise;
            if (!stripe) return;

            stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent }) => {
                switch (paymentIntent?.status) {
                    case "succeeded":
                        setStatus("success");
                        setMessage("Payment succeeded! We've received your order.");
                        // Clear cart locally on success
                        clearCart();
                        break;
                    case "processing":
                        setStatus("success");
                        setMessage("Your payment is processing. We'll update you when payment is received.");
                        clearCart();
                        break;
                    case "requires_payment_method":
                        setStatus("error");
                        setMessage("Your payment was not successful, please try again.");
                        break;
                    default:
                        setStatus("error");
                        setMessage("Something went wrong with retrieving your payment status.");
                        break;
                }
            });
        };

        checkStatus();
    }, [searchParams, clearCart]);

    if (status === "loading") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <LoadingIndicator size="lg" />
                <p className="mt-4 text-gray-500">Confirming your payment...</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-16 sm:py-24 text-center">
            {status === "success" ? (
                <>
                    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-green-100 mb-8">
                        <CheckCircle2 className="h-12 w-12 text-green-600" />
                    </div>
                    <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
                        Thank you for your order!
                    </h1>
                    <p className="text-lg text-gray-600 mb-10">
                        {message} You will receive an email confirmation shortly.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link href="/dashboard">
                            <Button variant="secondary" className="w-full sm:w-auto">Go to Dashboard</Button>
                        </Link>
                        <Link href="/products">
                            <Button className="w-full sm:w-auto">Continue Shopping</Button>
                        </Link>
                    </div>
                </>
            ) : (
                <>
                    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-100 mb-8">
                        <AlertCircle className="h-12 w-12 text-red-600" />
                    </div>
                    <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
                        Payment Failed
                    </h1>
                    <p className="text-lg text-gray-600 mb-10">
                        {message}
                    </p>
                    <Link href="/checkout">
                        <Button className="w-full sm:w-auto">Try Again</Button>
                    </Link>
                </>
            )}
        </div>
    );
}

export default function CheckoutSuccessPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <LoadingIndicator size="lg" />
                <p className="mt-4 text-gray-500">Loading payment status...</p>
            </div>
        }>
            <CheckoutSuccessContent />
        </Suspense>
    );
}
