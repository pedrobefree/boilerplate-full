"use client";

import { useEffect, useState } from 'react';
import { useCart } from '@/app/context/CartContext';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import CheckoutForm from './CheckoutForm';
import { LoadingIndicator } from '@/components/ui/LoadingIndicator';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

// Make sure to call loadStripe outside of a component’s render to avoid recreating the Stripe object on every render.
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function CheckoutPage() {
    const { items, totalPrice } = useCart();
    const [clientSecret, setClientSecret] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Create PaymentIntent as soon as the page loads
        if (items.length > 0) {
            fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items }),
            })
                .then((res) => {
                    if (!res.ok) throw new Error('Network response was not ok');
                    return res.json();
                })
                .then((data) => {
                    if (data.error) throw new Error(data.error);
                    setClientSecret(data.clientSecret);
                })
                .catch((err) => {
                    console.error('Checkout error:', err);
                    setError('Failed to initialize checkout. Please try again.');
                });
        }
    }, [items]);

    if (items.length === 0) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-16 text-center">
                <h1 className="text-3xl font-bold mb-4">Your cart is empty</h1>
                <p className="text-gray-500 mb-8">Add some products to your cart before proceeding to checkout.</p>
                <Link href="/products">
                    <Button>Browse Products</Button>
                </Link>
            </div>
        );
    }

    const options: StripeElementsOptions = {
        clientSecret,
        appearance: {
            theme: 'stripe',
            variables: {
                colorPrimary: '#3b82f6', // Adjust to brand color if needed
            },
        },
    };

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 lg:py-16">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-8 tracking-tight">Checkout</h1>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

                {/* Checkout Form */}
                <div className="lg:col-span-8">
                    {error ? (
                        <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                            {error}
                        </div>
                    ) : clientSecret ? (
                        <Elements options={options} stripe={stripePromise}>
                            <CheckoutForm />
                        </Elements>
                    ) : (
                        <div className="flex justify-center py-20">
                            <LoadingIndicator size="lg" />
                        </div>
                    )}
                </div>

                {/* Order Summary Sidebar */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 sticky top-24">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">Order Summary</h2>
                        <ul className="space-y-4 mb-6">
                            {items.map(item => (
                                <li key={item.id} className="flex justify-between items-start text-sm">
                                    <div className="flex-1 pr-4">
                                        <p className="font-medium text-gray-900 line-clamp-1">{item.product.name}</p>
                                        <p className="text-gray-500 mt-0.5">Qty {item.quantity}</p>
                                    </div>
                                    <span className="font-medium text-gray-900 whitespace-nowrap">
                                        {new Intl.NumberFormat('en-US', {
                                            style: 'currency',
                                            currency: item.price.currency.toUpperCase()
                                        }).format((item.price.unit_amount * item.quantity) / 100)}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        <div className="border-t border-gray-200 pt-4 space-y-2">
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Subtotal</span>
                                <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: items[0]?.price.currency.toUpperCase() || 'USD' }).format(totalPrice / 100)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Taxes</span>
                                <span>Calculated at next step</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold text-gray-900 mt-4 pt-4 border-t border-gray-200">
                                <span>Total</span>
                                <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: items[0]?.price.currency.toUpperCase() || 'USD' }).format(totalPrice / 100)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
