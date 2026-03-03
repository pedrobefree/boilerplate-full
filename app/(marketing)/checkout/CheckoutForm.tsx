"use client";

import { useEffect, useState } from "react";
import {
    PaymentElement,
    LinkAuthenticationElement,
    AddressElement,
    useStripe,
    useElements
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { useCart } from "@/app/context/CartContext";

export default function CheckoutForm() {
    const stripe = useStripe();
    const elements = useElements();
    const router = useRouter();
    const { clearCart } = useCart();

    const [message, setMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // If the user is returned here after a redirect-based payment (e.g. bank redirect),
    // check the status from the URL and show feedback.
    useEffect(() => {
        if (!stripe) return;

        const clientSecret = new URLSearchParams(window.location.search).get(
            "payment_intent_client_secret"
        );
        if (!clientSecret) return;

        stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent }) => {
            switch (paymentIntent?.status) {
                case "succeeded":
                    clearCart();
                    router.push(`/checkout/success?payment_intent_client_secret=${clientSecret}`);
                    break;
                case "processing":
                    setMessage("Your payment is processing. We'll update you when payment is received.");
                    break;
                case "requires_payment_method":
                    setMessage("Your payment was not successful, please try again.");
                    break;
                default:
                    setMessage("Something went wrong. Please try again.");
                    break;
            }
        });
    }, [stripe, clearCart, router]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!stripe || !elements) return;

        setIsLoading(true);
        setMessage(null);

        // First, submit the elements form to validate it
        const { error: submitError } = await elements.submit();
        if (submitError) {
            setMessage(submitError.message || "Please check your payment details.");
            setIsLoading(false);
            return;
        }

        // Use redirect: 'if_required' so that card payments resolve in-page
        // without a forced browser redirect. Only payment methods requiring 3DS
        // or bank redirects will navigate away and return via the return_url.
        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/checkout/success`,
            },
            redirect: "if_required",
        });

        if (error) {
            // Immediate errors (card declined, invalid details, etc.)
            if (error.type === "card_error" || error.type === "validation_error") {
                setMessage(error.message || "Your card was declined. Please try another card.");
            } else {
                setMessage("An unexpected error occurred. Please try again.");
            }
            console.error("Stripe confirmPayment error:", error);
        } else if (paymentIntent?.status === "succeeded") {
            // Card payment resolved in-page — navigate to success
            clearCart();
            const secret = paymentIntent.client_secret;
            router.push(`/checkout/success?payment_intent_client_secret=${secret}`);
        } else if (paymentIntent?.status === "processing") {
            setMessage("Your payment is being processed. We'll let you know once confirmed.");
        } else {
            setMessage("Unexpected payment status. Please contact support.");
        }

        setIsLoading(false);
    };


    return (
        <form id="payment-form" onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Contact & Payment Details</h2>

            <div className="space-y-6">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Contact Information</h3>
                    <LinkAuthenticationElement id="link-authentication-element" />
                </div>

                <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Billing Address</h3>
                    <AddressElement id="address-element" options={{ mode: 'billing' }} />
                </div>

                <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment Method</h3>
                    <PaymentElement id="payment-element" options={{ layout: "tabs" }} />
                </div>
            </div>

            <button
                type="submit"
                disabled={isLoading || !stripe || !elements}
                className="w-full mt-8 h-12 text-lg inline-flex items-center justify-center rounded-lg font-semibold bg-brand-600 text-white hover:bg-brand-700 shadow-sm transition-colors disabled:pointer-events-none disabled:opacity-50"
                id="submit"
            >
                {isLoading ? (
                    <div className="flex items-center justify-center">
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                        Processing...
                    </div>
                ) : (
                    "Pay now"
                )}
            </button>

            {/* Show any error or success messages */}
            {message && (
                <div id="payment-message" className="mt-4 p-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
                    {message}
                </div>
            )}
        </form>
    );
}
