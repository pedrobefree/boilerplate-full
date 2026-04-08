"use client";

import { useEffect, useState, use } from "react";
import { getOrderById } from "@/app/actions/orders";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Package, Clock, CheckCircle2, Truck, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CancelOrderButton } from "./CancelOrderButton";

const STATUS_STEPS = [
    { id: 'Waiting for Payment', label: 'Order Placed', icon: Clock },
    { id: 'Payment Approved', label: 'Payment Approved', icon: CheckCircle2 },
    { id: 'Pending Delivery', label: 'Pending Delivery', icon: Truck },
    { id: 'Completed', label: 'Delivered', icon: Package },
];

export default function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchOrder = async () => {
            setLoading(true);
            try {
                const data = await getOrderById(id);
                if (!data) {
                    setError("Order not found");
                } else {
                    setOrder(data);
                }
            } catch (err: any) {
                console.error("Error fetching order details:", err);
                setError(err.message || "Failed to load order details");
            } finally {
                setLoading(false);
            }
        };

        fetchOrder();
    }, [id]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <LoadingIndicator size="lg" />
                <p className="mt-4 text-gray-500">Loading order details...</p>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="text-center py-20">
                <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                    <XCircle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{error || "Order not found"}</h2>
                <Link href="/orders">
                    <Button variant="secondary" className="mt-4">Back to Orders</Button>
                </Link>
            </div>
        );
    }

    const currentStatusIndex = STATUS_STEPS.findIndex(s => s.id === order.status);
    const isCanceled = order.status === 'Canceled';
    const canCancel = order.status === 'Payment Approved' || order.status === 'Pending Delivery';

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <Link href="/orders" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-brand-600 transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back to Orders
                </Link>
                {canCancel && <CancelOrderButton orderId={order.id} />}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-gray-100">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Order #{order.id.slice(0, 8)}</h1>
                        <p className="text-gray-500">Placed on {format(new Date(order.created_at), 'MMMM d, yyyy')}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-500 mb-1">Total Amount</p>
                        <p className="text-3xl font-extrabold text-brand-600">
                            {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: order.currency?.toUpperCase() || 'USD'
                            }).format(order.total_amount / 100)}
                        </p>
                    </div>
                </div>

                {/* Status Tracker */}
                <div className="py-12 px-4">
                    {isCanceled ? (
                        <div className="flex flex-col items-center text-center p-6 bg-red-50 border border-red-100 rounded-2xl">
                            <XCircle className="w-12 h-12 text-red-500 mb-3" />
                            <h3 className="text-xl font-bold text-red-900">Order Canceled</h3>
                            <p className="text-red-700">This order has been canceled and a refund has been initiated.</p>
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-100 -translate-y-1/2 hidden md:block" />
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 relative z-10">
                                {STATUS_STEPS.map((step, index) => {
                                    const Icon = step.icon;
                                    const isCompleted = index <= currentStatusIndex;
                                    const isCurrent = index === currentStatusIndex;

                                    return (
                                        <div key={step.id} className="flex flex-col items-center text-center group">
                                            <div className={cn(
                                                "w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-all duration-300",
                                                isCompleted ? "bg-brand-600 text-white shadow-lg shadow-brand-200" : "bg-white border-2 border-gray-100 text-gray-400"
                                            )}>
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <p className={cn(
                                                "text-xs font-bold uppercase tracking-wider transition-colors",
                                                isCompleted ? "text-brand-700" : "text-gray-400"
                                            )}>
                                                {step.label}
                                            </p>
                                            {isCurrent && (
                                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-600 animate-pulse" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Order Items */}
                <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5 text-gray-400" />
                        Order Items
                    </h3>
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                        {order.items?.map((item: any, index: number) => (
                            <div key={item.id} className={cn(
                                "flex items-center justify-between p-4",
                                index !== order.items.length - 1 && "border-b border-gray-100"
                            )}>
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden border border-gray-100">
                                        {item.product?.image ? (
                                            <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <Package className="w-8 h-8 text-gray-300" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900">{item.product?.name}</p>
                                        <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-gray-900">
                                        {new Intl.NumberFormat('en-US', {
                                            style: 'currency',
                                            currency: order.currency?.toUpperCase() || 'USD'
                                        }).format((item.unit_amount * item.quantity) / 100)}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {new Intl.NumberFormat('en-US', {
                                            style: 'currency',
                                            currency: order.currency?.toUpperCase() || 'USD'
                                        }).format(item.unit_amount / 100)} each
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sidebar info? Maybe address/contact */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        < Truck className="w-5 h-5 text-gray-400" />
                        Shipping Details
                    </h3>
                    <div className="text-sm text-gray-600 space-y-1">
                        <p className="font-bold text-gray-900">{order.billing_details?.name}</p>
                        <p>{order.billing_details?.address?.line1}</p>
                        {order.billing_details?.address?.line2 && <p>{order.billing_details?.address?.line2}</p>}
                        <p>{order.billing_details?.address?.city}, {order.billing_details?.address?.state} {order.billing_details?.address?.postal_code}</p>
                        <p>{order.billing_details?.address?.country}</p>
                    </div>
                </div>
                
                <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-gray-400" />
                        Billing Information
                    </h3>
                    <div className="text-sm text-gray-600 space-y-2">
                        <div className="flex justify-between">
                            <span>Payment Method</span>
                            <span className="font-bold text-gray-900">Stripe Card</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Email</span>
                            <span className="font-bold text-gray-900">{order.billing_details?.email}</span>
                        </div>
                        <div className="pt-2 flex justify-between border-t border-gray-50">
                            <span>Currency</span>
                            <span className="font-bold text-gray-900 uppercase">{order.currency}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
