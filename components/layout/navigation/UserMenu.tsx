import { useRef, useEffect, useState } from "react";
import type { Placement } from "@react-types/overlays";
import { ChevronsUpDown as ChevronSelectorVertical } from "lucide-react";
import { useAuth } from "@/components/features/auth/AuthProvider";
import { Button as AriaButton, DialogTrigger as AriaDialogTrigger, Popover as AriaPopover } from "react-aria-components";
import { AvatarLabelGroup } from "@/components/features/AvatarLabelGroup";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { cx } from "@/lib/utils";
import { NavAccountMenu } from "./NavAccountCard"; // Importing from sibling
import { isSuperAdmin as checkSuperAdmin } from "@/app/actions/auth-helpers";
import { useOrganization } from "@/app/context/OrganizationContext";
import { CreateOrganizationModal } from "@/components/features/organizations/CreateOrganizationModal";
import { ClientOnly } from "@/components/ui/ClientOnly";

export interface UserMenuProps {
    placement?: Placement;
}

export const UserMenu = ({
    placement,
}: UserMenuProps) => {
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
    const userAvatar = user?.user_metadata?.avatar_url || "";

    // Consistency with Sidebar: Display Organization if available, otherwise User
    // But header usually shows User Profile.
    // The user request said: "make sure to use the same user dropdown menu on both places".
    // Does it mean the TRIGGER or the CONTENT?
    // "top dropdown still has the Add workspace button, which means they are using different components" implies CONTENT.
    // But the trigger in Sidebar shows Org, Header shows User.
    // If I strictly follow "use the same user dropdown menu", I should probably keep the Trigger different (context aware) but the Menu Content SAME.
    // NavAccountMenu IS the content.
    // So I will use NavAccountMenu.

    const displayAccount = {
        name: userName,
        email: userEmail,
        avatar: userAvatar,
        status: "online",
        id: user?.id || "custom"
    };

    return (
        <>
            <div ref={triggerRef} className="relative flex w-full items-center gap-3 rounded-xl p-2 ring-1 ring-secondary ring-inset hover:bg-gray-50/50 transition-colors">
                <AvatarLabelGroup
                    size="md"
                    src={displayAccount.avatar}
                    title={displayAccount.name}
                    subtitle={displayAccount.email}
                    status={displayAccount.status as any}
                />

                <div className="absolute top-1.5 right-1.5">
                    <ClientOnly>
                        <AriaDialogTrigger>
                            <AriaButton className="flex cursor-pointer items-center justify-center rounded-md p-1.5 text-fg-quaternary outline-focus-ring transition duration-100 ease-linear hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2 focus-visible:outline-offset-2 pressed:bg-primary_hover pressed:text-fg-quaternary_hover">
                                <ChevronSelectorVertical className="size-4 shrink-0" />
                            </AriaButton>
                            <AriaPopover
                                placement={placement ?? (isDesktop ? "right bottom" : "top right")}
                                triggerRef={triggerRef}
                                offset={8}
                                className={({ isEntering, isExiting }) =>
                                    cx(
                                        "origin-(--trigger-anchor-point) will-change-transform z-50",
                                        isEntering &&
                                        "duration-150 ease-out animate-in fade-in placement-right:slide-in-from-left-0.5 placement-top:slide-in-from-bottom-0.5 placement-bottom:slide-in-from-top-0.5",
                                        isExiting &&
                                        "duration-100 ease-in animate-out fade-out placement-right:slide-out-to-left-0.5 placement-top:slide-out-to-bottom-0.5 placement-bottom:slide-out-to-top-0.5",
                                    )
                                }
                            >
                                {(props) => (
                                    <NavAccountMenu
                                        {...props}
                                        // @ts-ignore
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
