import { getOrderById, getPaymentIntentDetails } from "@/app/actions/orders";
import { getOrderActivityLogs } from "@/app/actions/activity-logs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";
import { OrderStatusUpdate } from "./OrderStatusUpdate";

export const dynamic = 'force-dynamic';

export default async function OrderDetailsPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params;
    const order = await getOrderById(id);

    if (!order) {
        return (
            <div className="p-6">
                <div className="mb-6">
                    <Link href="/admin/orders" className="text-sm text-brand-600 hover:text-brand-700 font-medium inline-flex items-center gap-1">
                        <ArrowLeft className="w-4 h-4" /> Back to Orders
                    </Link>
                </div>
                <Card>
                    <CardContent className="p-12 text-center text-gray-500">
                        Order not found.
                    </CardContent>
                </Card>
            </div>
        );
    }

    const [paymentDetails, orderActivityResponse] = await Promise.all([
        order?.stripe_payment_intent_id ? getPaymentIntentDetails(order.stripe_payment_intent_id) : Promise.resolve(null),
        getOrderActivityLogs(id),
    ]);

    const orderActivityLogs = orderActivityResponse.success ? orderActivityResponse.data : [];

    const formatPrice = (amount: number, currency: string) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency.toUpperCase()
        }).format(amount / 100);
    };

    const formatMetadataLabel = (key: string) =>
        key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ");

    const formatMetadataValue = (key: string, value: unknown, metadata: Record<string, any>) => {
        const normalizedKey = key.toLowerCase();
        const currency = typeof metadata.currency === "string"
            ? metadata.currency
            : typeof metadata.currency_code === "string"
                ? metadata.currency_code
                : typeof metadata.currencyCode === "string"
                    ? metadata.currencyCode
                    : order.currency;

        if (
            (
                normalizedKey === "total_amount" ||
                normalizedKey === "amount" ||
                normalizedKey === "unit_amount" ||
                normalizedKey.endsWith("_amount") ||
                normalizedKey.endsWith("amount")
            ) &&
            (typeof value === "number" || (typeof value === "string" && !Number.isNaN(Number(value))))
        ) {
            return formatPrice(Number(value), currency);
        }

        if (typeof value === "object" && value !== null) {
            return JSON.stringify(value, null, 2);
        }

        return String(value);
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

    const billingEmail = order.billing_details?.email;
    const billingName = order.billing_details?.name;
    const billingPhone = order.billing_details?.phone;

    const displayEmail = order.user?.email || billingEmail;
    const displayName = order.user?.full_name || [order.user?.first_name, order.user?.last_name].filter(Boolean).join(' ') || billingName || 'Unknown Customer';
    
    // Extracted payment method details if available
    const latestCharge = paymentDetails?.latest_charge || paymentDetails?.charges?.data?.[0]; // Fallback if latest_charge is not expanded but charges collection is present
    const paymentMethodDetails = latestCharge?.payment_method_details || paymentDetails?.payment_method?.card ? { card: paymentDetails.payment_method.card } : null;
    const receiptUrl = latestCharge?.receipt_url;
    const actionLabels: Record<string, string> = {
        order_created: "Order created",
        order_status_changed: "Order status changed",
        order_cancelled: "Order cancelled",
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link href="/admin/orders" className="text-sm text-brand-600 hover:text-brand-700 font-medium inline-flex items-center gap-1 mb-2">
                        <ArrowLeft className="w-4 h-4" /> Back to Orders
                    </Link>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        Order #{order.id.slice(0, 8)}
                        <OrderStatusUpdate orderId={order.id} currentStatus={order.status} />
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Placed on {new Date(order.created_at).toLocaleString()}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Customer Details */}
                <div className="space-y-6 md:col-span-1">
                    {/* Customer Details */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Customer Detail</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                                {order.user?.avatar_url ? (
                                    <img src={order.user.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg font-semibold text-gray-500">
                                        {(displayName[0] || 'U').toUpperCase()}
                                    </div>
                                )}
                                <div className="overflow-hidden">
                                    <div className="text-sm font-semibold text-gray-900 truncate" title={displayName}>
                                        {displayName}
                                    </div>
                                    {(displayEmail) && (
                                        <div className="text-xs text-gray-500 truncate" title={displayEmail}>{displayEmail}</div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                {(billingPhone || order.user?.phone) && (
                                    <div className="text-sm text-gray-600">
                                        <span className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Phone</span>
                                        {billingPhone || order.user?.phone}
                                    </div>
                                )}
                                
                                {order.billing_details && (
                                    <div>
                                        <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Billing Address</h4>
                                        <div className="text-sm text-gray-600 space-y-1">
                                            {order.billing_details.address ? (
                                                <>
                                                    <p>{order.billing_details.address.line1}</p>
                                                    {order.billing_details.address.line2 && <p>{order.billing_details.address.line2}</p>}
                                                    <p>{order.billing_details.address.city}, {order.billing_details.address.state} {order.billing_details.address.postal_code}</p>
                                                    <p>{order.billing_details.address.country}</p>
                                                </>
                                            ) : (
                                                <p className="italic text-gray-400">No address provided</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Payment Details */}
                    {paymentDetails && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Payment</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500">Amount:</span>
                                        <span className="font-semibold text-gray-900">{formatPrice(paymentDetails.amount, paymentDetails.currency)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500">Status:</span>
                                        <Badge variant={paymentDetails.status === 'succeeded' ? 'success' : 'default'} className="uppercase text-[10px]">
                                            {paymentDetails.status}
                                        </Badge>
                                    </div>
                                    
                                    {paymentMethodDetails?.card && (
                                        <div className="pt-3 border-t border-gray-100 flex items-center gap-3">
                                            <div className="w-10 h-6 bg-gray-100 rounded flex items-center justify-center text-[10px] font-bold text-gray-600 uppercase border border-gray-200">
                                                {paymentMethodDetails.card.brand}
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                **** **** **** {paymentMethodDetails.card.last4}
                                            </div>
                                        </div>
                                    )}

                                    {receiptUrl && (
                                        <div className="pt-3 border-t border-gray-100">
                                            <a 
                                                href={receiptUrl} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-xs text-brand-600 hover:text-brand-700 font-medium justify-between flex items-center group w-full"
                                            >
                                                View Receipt
                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                                            </a>
                                        </div>
                                    )}
                                    
                                    <div className="pt-3 border-t border-gray-100">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-500">Created:</span>
                                            <span className="text-gray-900">{new Date(paymentDetails.created * 1000).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Order Items */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-lg">Items</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 border-y border-gray-100">
                                    <tr>
                                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Product</th>
                                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase text-right">Price</th>
                                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase text-center">Qty</th>
                                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(order.items || []).map((item: any) => (
                                        <tr key={item.id}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {item.product?.image && (
                                                        <div className="w-10 h-10 rounded overflow-hidden bg-gray-100 shrink-0">
                                                            <img src={item.product.image} alt="" className="w-full h-full object-cover" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">{item.product?.name || 'Unknown Product'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 text-right">
                                                {formatPrice(item.unit_amount, order.currency)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 text-center">
                                                {item.quantity}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                                                {formatPrice(item.unit_amount * item.quantity, order.currency)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-50">
                                    <tr>
                                        <td colSpan={3} className="px-6 py-4 text-sm font-medium text-gray-600 text-right">
                                            Total
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right">
                                            {formatPrice(order.total_amount, order.currency)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        
                        <div className="px-6 py-4 border-t border-gray-100 text-xs text-gray-500">
                            Payment Intent ID: <span className="font-mono">{order.stripe_payment_intent_id || 'N/A'}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <History className="size-5 text-gray-400" />
                        Order Activity
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {orderActivityLogs.length > 0 ? (
                        <div className="space-y-4">
                            {orderActivityLogs.map((log: any) => {
                                const actor = Array.isArray(log.actor) ? log.actor[0] : log.actor;

                                return (
                                    <div key={log.id} className="flex gap-4 border-l-2 border-gray-200 pl-4">
                                        <div className="pt-0.5">
                                            <Avatar
                                                src={actor?.avatar_url || undefined}
                                                alt={actor?.full_name || actor?.email || "System"}
                                                size="sm"
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">
                                                        {actionLabels[log.action] || log.action}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {actor?.full_name || actor?.email || "System"}
                                                    </p>
                                                </div>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </p>
                                            </div>

                                            {log.metadata && Object.keys(log.metadata).length > 0 ? (
                                                <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                                                    <div className="grid gap-2 sm:grid-cols-2">
                                                        {Object.entries(log.metadata).map(([key, value]) => (
                                                            <div key={key}>
                                                                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                                                                    {formatMetadataLabel(key)}
                                                                </p>
                                                                <p className="mt-1 text-sm text-gray-700 break-words whitespace-pre-wrap">
                                                                    {formatMetadataValue(key, value, log.metadata)}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">No activity recorded for this order yet.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
