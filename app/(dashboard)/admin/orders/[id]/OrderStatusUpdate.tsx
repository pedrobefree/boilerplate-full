"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { SelectItem } from "@/components/ui/SelectItem";
import { Button } from "@/components/ui/Button";
import { updateOrderStatus } from "@/app/actions/orders";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface OrderStatusUpdateProps {
    orderId: string;
    currentStatus: string;
}

const ORDER_STATUSES = [
    { id: 'Waiting for Payment', label: 'Waiting for Payment', rank: 1 },
    { id: 'Payment Approved', label: 'Payment Approved', rank: 2 },
    { id: 'Pending Delivery', label: 'Pending Delivery', rank: 3 },
    { id: 'Completed', label: 'Completed', rank: 4 },
    { id: 'Canceled', label: 'Canceled', rank: 5 },
];

export function OrderStatusUpdate({ orderId, currentStatus }: OrderStatusUpdateProps) {
    const router = useRouter();
    const { addToast } = useToast();
    const [status, setStatus] = useState<string>(currentStatus);
    const [isConfirming, setIsConfirming] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const currentRank = ORDER_STATUSES.find(s => s.id === currentStatus)?.rank || 0;
    const isFinalState = currentStatus === 'Completed' || currentStatus === 'Canceled';

    const handleStatusChange = async (newStatus: string) => {
        if (newStatus === currentStatus) return;

        if (newStatus === 'Canceled') {
            setIsModalOpen(true);
            return;
        }

        await updateStatus(newStatus);
    };

    const updateStatus = async (newStatus: string) => {
        setIsConfirming(true);
        try {
            const result = await updateOrderStatus(orderId, newStatus);
            if (result.success) {
                setStatus(newStatus);
                addToast({
                    title: "Status updated",
                    description: `Order status changed to ${newStatus}`,
                    type: "success",
                });
                router.refresh();
            } else {
                addToast({
                    title: "Error",
                    description: result.error || "Failed to update status",
                    type: "error",
                });
            }
        } catch (error) {
            console.error("Error updating status:", error);
            addToast({
                title: "Error",
                description: "An unexpected error occurred",
                type: "error",
            });
        } finally {
            setIsConfirming(false);
            setIsModalOpen(false);
        }
    };

    return (
        <div className="flex items-center gap-3">
            <Select
                selectedKey={status}
                onSelectionChange={(k) => handleStatusChange(k as string)}
                isDisabled={isConfirming || isFinalState}
                aria-label="Order status"
                className="w-48"
            >
                {ORDER_STATUSES.map((s) => {
                    // Disable if:
                    // 1. It's a previous status (lower rank)
                    // 2. It's 'Canceled' but the current status is 'Completed'
                    const isPrevious = s.rank < currentRank;
                    const isCanceledAfterCompleted = s.id === 'Canceled' && currentStatus === 'Completed';
                    const isDisabled = isPrevious || isCanceledAfterCompleted;

                    return (
                        <SelectItem key={s.id} id={s.id} isDisabled={isDisabled}>
                            {s.label}
                        </SelectItem>
                    );
                })}
            </Select>

            <ConfirmDialog
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={() => updateStatus('Canceled')}
                title="Cancel Order"
                description="Are you sure you want to cancel this order? This will automatically initiate a refund via Stripe for the total amount. This action cannot be undone."
                confirmText="Yes, cancel and refund"
                cancelText="No, keep it"
                variant="destructive"
                isLoading={isConfirming}
            />
        </div>
    );
}
