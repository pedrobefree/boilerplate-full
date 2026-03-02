"use client";

import type { FC, HTMLAttributes } from "react";
import { useCallback, useEffect, useRef, useState, useId } from "react";
import type { Placement } from "@react-types/overlays";
import { BookOpen, ChevronsUpDown as ChevronSelectorVertical, LogOut, Plus, Settings, User as User01, Check } from "lucide-react";
const LogOut01 = LogOut; const Settings01 = Settings; const BookOpen01 = BookOpen;

import { useFocusManager } from "react-aria";
import type { DialogProps as AriaDialogProps } from "react-aria-components";
import { Button as AriaButton, Dialog as AriaDialog, DialogTrigger as AriaDialogTrigger, Popover as AriaPopover } from "react-aria-components";
import { AvatarLabelGroup } from "@/components/features/AvatarLabelGroup";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/features/auth/AuthProvider";
import { useOrganization } from "@/app/context/OrganizationContext";
import { CreateOrganizationModal } from "@/components/features/organizations/CreateOrganizationModal";
import { isSuperAdmin as checkSuperAdmin } from "@/app/actions/auth-helpers";
import { ClientOnly } from "@/components/ui/ClientOnly";

const RadioButtonBase = ({ isSelected, className }: { isSelected: boolean, className?: string }) => (
    <div className={cx("flex h-4 w-4 items-center justify-center rounded-full border border-gray-300", isSelected && "bg-brand-600 border-brand-600", className)}>
        {isSelected && <Check className="h-3 w-3 text-white" />}
    </div>
);

import { useBreakpoint } from "@/hooks/use-breakpoint";
import { cx } from "@/lib/utils";

type NavAccountType = {
    id: string;
    name: string;
    email: string;
    avatar: string;
    status: "online" | "offline";
    slug?: string;
};

export const NavAccountMenu = ({
    className,
    ...dialogProps
}: AriaDialogProps & { className?: string; selectedAccountId?: string }) => {
    const router = useRouter();
    const { signOut, user } = useAuth();
    const { organizations, currentOrganization, switchOrganization } = useOrganization();

    // Manage Create Modal State locally here, but we need to trigger it from the menu
    // We'll pass a callback up or use a separate state in the Card
    // Actually, Dialog inside Dialog is tricky. 
    // We'll expose an onAddWorkspace prop.

    // Wait, AriaDialogProps might need to be passed strictly.
    // Let's grab the setOpen function if possible, or just close on action.

    const focusManager = useFocusManager();
    const dialogRef = useRef<HTMLDivElement>(null);

    // Explicitly define onAddWorkspace in props or use context?
    // Let's assume the parent handles the modal rendering for simplicity or we render it triggered by a state in the parent.
    // BUT this component is inside the Popover.

    // We will emit an event or callback.
    // Actually, we can just receive `onAddWorkspace` prop.
    const onAddWorkspace = (dialogProps as any).onAddWorkspace;


    const onKeyDown = useCallback(
        (e: KeyboardEvent) => {
            switch (e.key) {
                case "ArrowDown":
                    focusManager?.focusNext({ tabbable: true, wrap: true });
                    break;
                case "ArrowUp":
                    focusManager?.focusPrevious({ tabbable: true, wrap: true });
                    break;
            }
        },
        [focusManager],
    );

    useEffect(() => {
        const element = dialogRef.current;
        if (element) {
            element.addEventListener("keydown", onKeyDown);
        }

        return () => {
            if (element) {
                element.removeEventListener("keydown", onKeyDown);
            }
        };
    }, [onKeyDown]);

    return (
        <AriaDialog
            {...dialogProps}
            ref={dialogRef}
            className={cx("w-66 rounded-xl bg-secondary_alt shadow-lg ring ring-secondary_alt outline-hidden", className)}
        >
            {({ close }) => (
                <div className="rounded-xl bg-primary ring-1 ring-secondary">
                    <div className="flex flex-col gap-0.5 py-1.5">
                        <NavAccountCardMenuItem
                            label="View profile"
                            icon={User01}
                            shortcut="⌘K->P"
                            onClick={() => {
                                router.push("/settings");
                                close();
                            }}
                        />
                        {(currentOrganization?.role !== "member" || (dialogProps as any).isSuperAdmin) && (
                            <NavAccountCardMenuItem
                                label="Workspace settings"
                                icon={Settings01}
                                shortcut="⌘S"
                                onClick={() => {
                                    router.push("/settings/organization");
                                    close();
                                }}
                            />
                        )}
                        <NavAccountCardMenuItem
                            label="Documentation"
                            icon={BookOpen01}
                            onClick={() => {
                                router.push("/docs");
                                close();
                            }}
                        />
                    </div>
                    <div className="flex flex-col gap-0.5 border-t border-secondary py-1.5">
                        <div className="px-3 pt-1.5 pb-1 text-xs font-semibold text-tertiary">Switch Workspace</div>

                        <div className="flex flex-col gap-0.5 px-1.5 max-h-48 overflow-y-auto">
                            {organizations.map((org) => (
                                <button
                                    key={org.id}
                                    onClick={() => {
                                        switchOrganization(org.id);
                                        close();
                                    }}
                                    className={cx(
                                        "relative w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-primary_hover",
                                        currentOrganization?.id === org.id && "bg-secondary_subtle"
                                    )}
                                >
                                    <AvatarLabelGroup
                                        status={undefined}
                                        size="sm"
                                        src="" // Organizations don't have avatars yet, use fallback or initials
                                        fallback={org.name.substring(0, 2).toUpperCase()}
                                        title={org.name}
                                        subtitle={org.slug}
                                    />
                                    {currentOrganization?.id === org.id && (
                                        <div className="absolute top-1/2 right-2 -translate-y-1/2">
                                            <Check className="h-4 w-4 text-brand-600" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 px-2 pt-0.5 pb-2">
                        {/* Only Super Admins can add workspaces */}
                        {(dialogProps as any).isSuperAdmin && (
                            <Button
                                variant="secondary"
                                size="sm"
                                className="w-full justify-start gap-2"
                                onClick={() => {
                                    close();
                                    onAddWorkspace?.();
                                }}
                            >
                                <Plus className="size-4" /> Add workspace
                            </Button>
                        )}
                    </div>

                    <div className="border-t border-secondary pt-1 pb-1.5">
                        <NavAccountCardMenuItem
                            label="Sign out"
                            icon={LogOut01}
                            shortcut="⌥⇧Q"
                            onClick={async () => {
                                await signOut();
                                close();
                            }}
                        />
                    </div>
                </div>
            )}
        </AriaDialog>
    );
};

// ... NavAccountCardMenuItem remains similar ...
const NavAccountCardMenuItem = ({
    icon: Icon,
    label,
    shortcut,
    ...buttonProps
}: {
    icon?: FC<{ className?: string }>;
    label: string;
    shortcut?: string;
} & HTMLAttributes<HTMLButtonElement>) => {
    return (
        <button {...buttonProps} className={cx("group/item w-full cursor-pointer px-1.5 focus:outline-hidden", buttonProps.className)}>
            <div
                className={cx(
                    "flex w-full items-center justify-between gap-3 rounded-md p-2 group-hover/item:bg-primary_hover",
                    // Focus styles.
                    "outline-focus-ring group-focus-visible/item:outline-2 group-focus-visible/item:outline-offset-2",
                )}
            >
                <div className="flex gap-2 text-sm font-semibold text-secondary group-hover/item:text-secondary_hover">
                    {Icon && <Icon className="size-5 text-fg-quaternary" />} {label}
                </div>

                {shortcut && (
                    <kbd className="flex rounded px-1 py-px font-body text-xs font-medium text-tertiary ring-1 ring-secondary ring-inset">{shortcut}</kbd>
                )}
            </div>
        </button>
    );
};

export const NavAccountCard = ({
    popoverPlacement,
}: {
    popoverPlacement?: Placement;
}) => {
    const triggerRef = useRef<HTMLDivElement>(null);
    const isDesktop = useBreakpoint();
    const { user } = useAuth();
    const { currentOrganization } = useOrganization();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    useEffect(() => {
        checkSuperAdmin().then(setIsSuperAdmin);
    }, []);

    // Prefer User Metadata name, then email, then display fallback
    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User";
    const userEmail = user?.email || "user@example.com";
    const userAvatar = user?.user_metadata?.avatar_url || ""; // placeholderAccounts[0].avatar;

    // Display Current Organization or Fallback to User
    const displayTitle = currentOrganization?.name || userName;
    const displaySubtitle = currentOrganization ? "Workspace" : userEmail;
    // For avatar, ideally org has one. For now use user's or generate one.

    const triggerId = useId();

    return (
        <>
            <div ref={triggerRef} className="relative flex items-center gap-3 rounded-xl p-3 ring-1 ring-secondary ring-inset">
                <AvatarLabelGroup
                    size="md"
                    src={userAvatar}
                    fallback={currentOrganization?.name?.substring(0, 2).toUpperCase() || userName.substring(0, 2).toUpperCase()}
                    title={displayTitle}
                    subtitle={displaySubtitle}
                    status="online"
                />

                <div className="absolute top-1.5 right-1.5">
                    <ClientOnly fallback={<div className="p-1.5" />}>
                        <AriaDialogTrigger>
                            <AriaButton
                                id={triggerId}
                                className="flex cursor-pointer items-center justify-center rounded-md p-1.5 text-fg-quaternary outline-focus-ring transition duration-100 ease-linear hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2 focus-visible:outline-offset-2 pressed:bg-primary_hover pressed:text-fg-quaternary_hover"
                            >
                                <ChevronSelectorVertical className="size-4 shrink-0" />
                            </AriaButton>
                            <AriaPopover
                                placement={popoverPlacement ?? (isDesktop ? "right bottom" : "top right")}
                                triggerRef={triggerRef}
                                offset={8}
                                className={({ isEntering, isExiting }) =>
                                    cx(
                                        "origin-(--trigger-anchor-point) will-change-transform",
                                        isEntering &&
                                        "duration-150 ease-out animate-in fade-in placement-right:slide-in-from-left-0.5 placement-top:slide-in-from-bottom-0.5 placement-bottom:slide-in-from-top-0.5",
                                        isExiting &&
                                        "duration-100 ease-in animate-out fade-out placement-right:slide-out-to-left-0.5 placement-top:slide-out-to-bottom-0.5 placement-bottom:slide-out-to-top-0.5",
                                    )
                                }
                            >
                                {/* Pass onAddWorkspace to the inner menu */}
                                {(props) => (
                                    <NavAccountMenu
                                        {...props}
                                        // @ts-ignore - passing custom prop
                                        onAddWorkspace={() => setIsCreateModalOpen(true)}
                                        isSuperAdmin={isSuperAdmin}
                                    />
                                )}
                            </AriaPopover>
                        </AriaDialogTrigger>
                    </ClientOnly>
                </div>
            </div>

            <CreateOrganizationModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />
        </>
    );
};
