"use client";

import { AlertTriangle } from "lucide-react";
import { Dialog, DialogTrigger, Modal, ModalOverlay } from "./Modal";
import { Button } from "./Button";
import { useState } from "react";
import { cx } from "@/lib/utils";

export interface ConfirmDialogProps {
    /** Whether the dialog is open */
    isOpen: boolean;
    /** Callback when dialog is closed */
    onClose: () => void;
    /** Callback when user confirms the action */
    onConfirm: () => void | Promise<void>;
    /** Dialog title */
    title: string;
    /** Dialog description/message */
    description: string;
    /** Text for the confirm button */
    confirmText?: string;
    /** Text for the cancel button */
    cancelText?: string;
    /** Visual variant of the dialog */
    variant?: "default" | "destructive";
    /** Whether the confirm action is loading */
    isLoading?: boolean;
}

/**
 * ConfirmDialog - A reusable confirmation dialog component
 * 
 * Use this instead of window.confirm() for a consistent, accessible confirmation experience.
 * Supports both default and destructive variants for different action types.
 * 
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 * 
 * <ConfirmDialog
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onConfirm={async () => {
 *     await deleteUser();
 *     setIsOpen(false);
 *   }}
 *   title="Remove user"
 *   description="Are you sure you want to remove this user? This action cannot be undone."
 *   variant="destructive"
 * />
 * ```
 */
export const ConfirmDialog = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "default",
    isLoading = false,
}: ConfirmDialogProps) => {
    const [isConfirming, setIsConfirming] = useState(false);

    const handleConfirm = async () => {
        setIsConfirming(true);
        try {
            await onConfirm();
        } finally {
            setIsConfirming(false);
        }
    };

    const isDestructive = variant === "destructive";

    return (
        <ModalOverlay isOpen={isOpen} onOpenChange={(open) => !open && onClose()} isDismissable={!isConfirming && !isLoading}>
            <Modal className="sm:max-w-md">
                <Dialog className="outline-none">
                    <div className="p-6 space-y-4">
                        {/* Icon */}
                        <div className={cx(
                            "mx-auto flex h-12 w-12 items-center justify-center rounded-full",
                            isDestructive ? "bg-error-100" : "bg-brand-100"
                        )}>
                            <AlertTriangle className={cx(
                                "h-6 w-6",
                                isDestructive ? "text-error-600" : "text-brand-600"
                            )} />
                        </div>

                        {/* Content */}
                        <div className="text-center space-y-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                                {title}
                            </h3>
                            <p className="text-sm text-gray-500">
                                {description}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                            <Button
                                variant="secondary"
                                className="flex-1"
                                onPress={onClose}
                                isDisabled={isConfirming || isLoading}
                            >
                                {cancelText}
                            </Button>
                            <Button
                                variant={isDestructive ? "destructive" : "primary"}
                                className="flex-1"
                                onPress={handleConfirm}
                                isDisabled={isConfirming || isLoading}
                            >
                                {isConfirming || isLoading ? "Processing..." : confirmText}
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
};
