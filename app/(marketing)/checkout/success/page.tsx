"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/app/context/CartContext";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { getOrderByPaymentIntent } from "@/app/actions/orders";
import { Key, Mail } from "lucide-react";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/Button";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function CheckoutSuccessContent() {
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("");
    const [magicLink, setMagicLink] = useState<string | null>(null);
    const { clearCart } = useCart();

    useEffect(() => {
        let isPolling = true;

        const checkStatus = async () => {
            const clientSecret = searchParams.get("payment_intent_client_secret");

            if (!clientSecret) {
                setStatus("error");
                setMessage("Invalid payment session.");
                return;
            }

            // Extract Payment Intent ID from client secret
            const paymentIntentId = clientSecret.split('_secret')[0];

            const stripe = await stripePromise;
            if (!stripe) return;

            const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
            
            if (paymentIntent?.status === "succeeded") {
                clearCart();
                let attempt = 0;
                let foundLink = null;
                
                // Webhooks can take a few seconds to hit our server and create the user.
                // We'll poll up to 10 times (20 seconds total) waiting for the magic_link to populate.
                while (isPolling && attempt < 10) {
                    try {
                        const order = await getOrderByPaymentIntent(paymentIntentId);
                        if (order?.magic_link) {
                            foundLink = order.magic_link;
                            break; // Stop polling once we find the link!
                        }
                    } catch (e) {
                        console.error("Polling order error:", e);
                    }
                    attempt++;
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

                if (isPolling) {
                    setStatus("success");
                    setMessage("Payment succeeded! We've received your order.");
                    if (foundLink) setMagicLink(foundLink);
                }
            } else if (paymentIntent?.status === "processing") {
                setStatus("success");
                setMessage("Your payment is processing. We'll update you when payment is received.");
                clearCart();
            } else if (paymentIntent?.status === "requires_payment_method") {
                setStatus("error");
                setMessage("Your payment was not successful, please try again.");
            } else {
                setStatus("error");
                setMessage("Something went wrong with retrieving your payment status.");
            }
        };

        checkStatus();

        return () => {
            isPolling = false;
        };
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

                    {magicLink && (
                        <div className="mb-12 p-8 bg-brand-50 border-2 border-brand-200 rounded-2xl text-left shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-brand-100 rounded-lg">
                                    <Key className="h-6 w-6 text-brand-600" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">Access Your Account</h2>
                            </div>
                            <p className="text-gray-700 mb-6 font-medium">
                                We've created an account for you. Click the button below to log in and access your orders. You can set your password from your account settings.
                            </p>
                            <a 
                                href={magicLink} 
                                className={cn(buttonVariants({ variant: 'primary', size: 'xl' }), "w-full text-center")}
                            >
                                Log In &amp; Access My Orders
                            </a>
                            <div className="mt-4 flex items-start gap-2 text-sm text-brand-600">
                                <Mail className="h-4 w-4 mt-0.5" />
                                <p>This link will log you in automatically. Use it only once.</p>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        {!magicLink && (
                            <Link href="/dashboard">
                                <Button variant="secondary" className="w-full sm:w-auto h-12 px-8">Go to Dashboard</Button>
                            </Link>
                        )}
                        <Link href="/products">
                            <Button className="w-full sm:w-auto h-12 px-8 text-gray-600 bg-white border border-gray-200 hover:bg-gray-50">Continue Shopping</Button>
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
