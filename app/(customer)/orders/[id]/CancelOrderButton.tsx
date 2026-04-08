"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { updateOrderStatus } from "@/app/actions/orders";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";

export function CancelOrderButton({ orderId }: { orderId: string }) {
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleCancel = async () => {
        setIsLoading(true);
        try {
            const result = await updateOrderStatus(orderId, 'Canceled');
            if (result.success) {
                router.refresh();
                setIsConfirmOpen(false);
            } else {
                alert(result.error || "Failed to cancel order");
            }
        } catch (error: any) {
            console.error("Error canceling order:", error);
            alert(error.message || "An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Button 
                variant="secondary" 
                size="sm"
                className="text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                onPress={() => setIsConfirmOpen(true)}
            >
                <XCircle className="w-4 h-4 mr-2" />
                Cancel Order
            </Button>

            <ConfirmDialog
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleCancel}
                title="Cancel Order"
                description="Are you sure you want to cancel this order? This will initiate a full refund through Stripe. This action cannot be undone."
                confirmText="Yes, Cancel Order"
                variant="destructive"
                isLoading={isLoading}
            />
        </>
    );
}
