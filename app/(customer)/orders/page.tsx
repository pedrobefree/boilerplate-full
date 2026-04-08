"use client";

import { useEffect, useState } from "react";
import { getOrders, OrderFilters } from "@/app/actions/orders";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronRight, Package, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_VARIANTS: Record<string, string> = {
    'Waiting for Payment': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    'Payment Approved': 'bg-blue-50 text-blue-700 border-blue-200',
    'Pending Delivery': 'bg-purple-50 text-purple-700 border-purple-200',
    'Completed': 'bg-green-50 text-green-700 border-green-200',
    'Canceled': 'bg-red-50 text-red-700 border-red-200',
};

export default function CustomerOrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<OrderFilters>({
        status: 'all',
        page: 1,
        limit: 10
    });

    useEffect(() => {
        const fetchOrders = async () => {
            setLoading(true);
            try {
                const result = await getOrders(filters);
                if (result.error) {
                    setError(result.error);
                } else {
                    setOrders(result.orders || []);
                }
            } catch (err: any) {
                console.error("Error fetching customer orders:", err);
                setError(err.message || "Failed to load orders");
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, [filters]);

    if (loading && orders.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <LoadingIndicator size="lg" />
                <p className="mt-4 text-gray-500">Loading your orders...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Your Orders</h1>
                    <p className="text-gray-500 mt-1">Track and manage your order history.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
                            className="appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2 pr-10 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all shadow-sm"
                        >
                            <option value="all">All Statuses</option>
                            <option value="Waiting for Payment">Waiting for Payment</option>
                            <option value="Payment Approved">Payment Approved</option>
                            <option value="Pending Delivery">Pending Delivery</option>
                            <option value="Completed">Completed</option>
                            <option value="Canceled">Canceled</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                            <Filter className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 font-medium">
                    {error}
                </div>
            )}

            {orders.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                    <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <Package className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No orders found</h3>
                    <p className="text-gray-500 mb-8 max-w-sm mx-auto">You haven't placed any orders yet or they don't match your current filters.</p>
                    <Link href="/products">
                        <Button className="h-12 px-8">Start Shopping</Button>
                    </Link>
                </div>
            ) : (
                <div className="grid gap-6">
                    {orders.map((order) => (
                        <Link 
                            key={order.id} 
                            href={`/orders/${order.id}`}
                            className="group block bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md hover:border-brand-200 transition-all"
                        >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-brand-50 transition-colors">
                                            <Package className="w-5 h-5 text-gray-500 group-hover:text-brand-600 transition-colors" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">Order #{order.id.slice(0, 8)}</p>
                                            <p className="text-xs text-gray-500">{format(new Date(order.created_at), 'MMMM d, yyyy')}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-2">
                                        {order.items?.map((item: any) => (
                                            <span key={item.id} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-50 border border-gray-200 text-gray-600 uppercase tracking-wider">
                                                {item.quantity}x {item.product?.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-col items-end gap-3">
                                    <span className={cn(
                                        "px-3 py-1 rounded-full text-xs font-bold border",
                                        STATUS_VARIANTS[order.status] || 'bg-gray-50 text-gray-700 border-gray-200'
                                    )}>
                                        {order.status}
                                    </span>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500">Total</p>
                                            <p className="text-lg font-bold text-gray-900">
                                                {new Intl.NumberFormat('en-US', {
                                                    style: 'currency',
                                                    currency: order.currency?.toUpperCase() || 'USD'
                                                }).format(order.total_amount / 100)}
                                            </p>
                                        </div>
                                        <div className="p-2 bg-gray-50 rounded-full group-hover:bg-brand-100 transition-colors">
                                            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-600 transition-colors" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
