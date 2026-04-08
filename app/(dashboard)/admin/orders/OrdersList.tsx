"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { SlidersHorizontal, Search, Eye, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { Select } from "@/components/ui/Select";
import { SelectItem } from "@/components/ui/SelectItem";
import { FilterSheet } from "@/components/ui/FilterSheet";
import { ClientOnly } from "@/components/ui/ClientOnly";
import { PaginationSimple } from "@/components/ui/Pagination";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { OrderFilters } from "@/app/actions/orders";

interface OrdersListProps {
    orders: any[];
    totalCount: number;
    initialFilters: OrderFilters;
}

export function OrdersList({ orders, totalCount, initialFilters }: OrdersListProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [statusFilter, setStatusFilter] = useState<string>(initialFilters.status || "all");
    const [searchQuery, setSearchQuery] = useState<string>(initialFilters.search || "");
    const [minValue, setMinValue] = useState<string>(initialFilters.minValue?.toString() || "");
    const [maxValue, setMaxValue] = useState<string>(initialFilters.maxValue?.toString() || "");

    const pageSize = initialFilters.limit || 10;
    const totalPages = Math.ceil(totalCount / pageSize);

    const updateFilters = (updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString());
        // Reset to page 1 when modifying filters
        params.set('page', '1');

        Object.entries(updates).forEach(([key, value]) => {
            if (value === null || value === '' || value === 'all') {
                params.delete(key);
            } else {
                params.set(key, value);
            }
        });

        router.push(`${pathname}?${params.toString()}`);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        updateFilters({ search: searchQuery });
    };

    const formatPrice = (amount: number, currency: string) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency.toUpperCase()
        }).format(amount / 100);
    };

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'completed':
            case 'Completed':
            case 'Payment Approved': return 'success';
            case 'pending':
            case 'Waiting for Payment': return 'warning';
            case 'processing':
            case 'Pending Delivery': return 'brand';
            case 'cancelled':
            case 'Canceled': return 'error';
            default: return 'default';
        }
    };

    const hasActiveFilters = !!(initialFilters.status && initialFilters.status !== 'all')
        || !!initialFilters.search
        || !!initialFilters.minValue
        || !!initialFilters.maxValue;

    const clearFilters = () => {
        setStatusFilter("all");
        setSearchQuery("");
        setMinValue("");
        setMaxValue("");
        router.push(pathname);
    };

    const handleApplyFilters = () => {
        updateFilters({
            status: statusFilter,
            minValue: minValue,
            maxValue: maxValue
        });
    };

    const filterContent = (
        <div className="space-y-6">
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Status</label>
                <Select
                    selectedKey={statusFilter}
                    onSelectionChange={(k) => setStatusFilter(k as string)}
                    placeholder="All Statuses"
                >
                    <SelectItem id="all">All Statuses</SelectItem>
                    <SelectItem id="Waiting for Payment">Waiting for Payment</SelectItem>
                    <SelectItem id="Payment Approved">Payment Approved</SelectItem>
                    <SelectItem id="Pending Delivery">Pending Delivery</SelectItem>
                    <SelectItem id="Completed">Completed</SelectItem>
                    <SelectItem id="Canceled">Canceled</SelectItem>
                </Select>
            </div>
            
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Value Range (Min/Max)</label>
                <div className="flex gap-2">
                    <Input 
                        placeholder="Min" 
                        type="number" 
                        value={minValue} 
                        onChange={(e) => setMinValue(e.target.value)}
                    />
                    <Input 
                        placeholder="Max" 
                        type="number" 
                        value={maxValue} 
                        onChange={(e) => setMaxValue(e.target.value)}
                    />
                </div>
            </div>
        </div>
    );

    const FilterChip = ({ label, onRemove }: { label: string; onRemove: () => void; }) => (
        <button
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
        >
            {label}
            <X className="w-3.5 h-3.5" />
        </button>
    );

    return (
        <ClientOnly fallback={<div className="space-y-4 animate-pulse"><div className="h-10 bg-gray-100 rounded" /><div className="h-96 bg-gray-100 rounded-xl" /></div>}>
            <div className="space-y-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Orders</h2>
                        <p className="text-sm text-gray-500">View and manage customer orders</p>
                    </div>
                </div>

                <Card>
                    <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-lg">All Orders</CardTitle>
                            <CardDescription>
                                {totalCount} order{totalCount !== 1 ? "s" : ""} found
                            </CardDescription>
                        </div>
                        
                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                updateFilters({ search: searchQuery });
                            }} className="relative flex-1 sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search customer..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            updateFilters({ search: searchQuery });
                                        }
                                    }}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                                />
                            </form>
                            
                            <FilterSheet
                                trigger={
                                    <Button variant="secondary" className="gap-2 shrink-0">
                                        <SlidersHorizontal className="size-4" />
                                        Filters
                                    </Button>
                                }
                                onClearAll={clearFilters}
                                onApply={handleApplyFilters}
                            >
                                {filterContent}
                            </FilterSheet>
                        </div>
                    </CardHeader>

                    {hasActiveFilters && (
                        <div className="flex flex-wrap items-center gap-2 px-6 py-3 bg-gray-50 border-y border-gray-100">
                            {initialFilters.status && initialFilters.status !== "all" && (
                                <FilterChip label={`Status: ${initialFilters.status}`} onRemove={() => { setStatusFilter("all"); updateFilters({ status: null }); }} />
                            )}
                            {initialFilters.search && (
                                <FilterChip label={`Search: ${initialFilters.search}`} onRemove={() => { setSearchQuery(""); updateFilters({ search: null }); }} />
                            )}
                            {initialFilters.minValue && (
                                <FilterChip label={`Min: $${initialFilters.minValue}`} onRemove={() => { setMinValue(""); updateFilters({ minValue: null }); }} />
                            )}
                            {initialFilters.maxValue && (
                                <FilterChip label={`Max: $${initialFilters.maxValue}`} onRemove={() => { setMaxValue(""); updateFilters({ maxValue: null }); }} />
                            )}
                            <Button variant="tertiary" size="sm" onPress={clearFilters}>
                                Clear all
                            </Button>
                        </div>
                    )}

                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-y border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Order ID / Date</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Customer</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Items</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Total Value</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {orders.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                                {hasActiveFilters ? "No orders match your filters." : "No orders found."}
                                            </td>
                                        </tr>
                                    ) : (
                                        orders.map((order) => (
                                            <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-semibold text-gray-900 font-mono truncate max-w-[120px]" title={order.id}>
                                                        #{order.id.slice(0, 8)}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        {new Date(order.created_at).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 flex items-center gap-3">
                                                    <Avatar 
                                                        src={order.user?.avatar_url} 
                                                        initials={(order.user?.first_name?.[0] || 'U').toUpperCase()} 
                                                        size="sm" 
                                                    />
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {order.user?.first_name} {order.user?.last_name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">Customer</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant="default" size="sm">
                                                        {order.itemsCount} item{order.itemsCount !== 1 ? 's' : ''}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                    {formatPrice(order.total_amount, order.currency)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant={getStatusVariant(order.status)}>
                                                        {order.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-right space-x-2">
                                                    <Link href={`/admin/orders/${order.id}`}>
                                                        <Button variant="tertiary" size="sm">
                                                            <Eye className="size-4" />
                                                        </Button>
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="px-6 py-4 border-t border-gray-100">
                                <PaginationSimple
                                    page={initialFilters.page || 1}
                                    total={totalPages}
                                    onPageChange={(p) => {
                                        const params = new URLSearchParams(searchParams.toString());
                                        params.set('page', p.toString());
                                        router.push(`${pathname}?${params.toString()}`);
                                    }}
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </ClientOnly>
    );
}
