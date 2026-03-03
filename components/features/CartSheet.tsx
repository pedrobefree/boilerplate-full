"use client";

import React from 'react';
import { useCart } from '@/app/context/CartContext';
import { SlideoutMenu } from '@/components/layout/SlideoutMenu';
import { Button } from '@/components/ui/Button';
import { ShoppingBag, Minus, Plus, Trash2 } from 'lucide-react';
import { ModalOverlay } from 'react-aria-components';
import { useRouter } from 'next/navigation';

export function CartSheet() {
    const { items, updateQuantity, removeFromCart, totalPrice, totalItems, isCartOpen, setIsCartOpen } = useCart();
    const router = useRouter();

    const formattedTotal = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: items.length > 0 ? items[0].price.currency.toUpperCase() : 'USD',
    }).format(totalPrice / 100);

    return (
        <SlideoutMenu.Overlay isOpen={isCartOpen} onOpenChange={setIsCartOpen}>
            <SlideoutMenu.Modal>
                <SlideoutMenu.Dialog>
                    <SlideoutMenu.Header onClose={() => setIsCartOpen(false)}>
                        <SlideoutMenu.Title className="flex items-center gap-2">
                            <ShoppingBag className="w-5 h-5" />
                            Your Cart ({totalItems})
                        </SlideoutMenu.Title>
                    </SlideoutMenu.Header>

                    <SlideoutMenu.Content className="p-0">
                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full p-6 text-center text-gray-500">
                                <ShoppingBag className="w-12 h-12 mb-4 text-gray-300" />
                                <p className="text-lg font-medium text-gray-900">Your cart is empty</p>
                                <p className="text-sm mt-1">Looks like you haven't added anything yet.</p>
                                <Button
                                    className="mt-6"
                                    onPress={() => setIsCartOpen(false)}
                                >
                                    Continue Shopping
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-100">
                                {items.map((item) => {
                                    const imgUrl = item.product.image || (item.product.images?.[0]?.url);
                                    const priceDisplay = new Intl.NumberFormat('en-US', {
                                        style: 'currency',
                                        currency: item.price.currency.toUpperCase(),
                                    }).format(item.price.unit_amount / 100);

                                    const isRecurring = item.price.type === 'recurring';
                                    const intervalDisplay = isRecurring ? `/${item.price.interval}` : "";

                                    return (
                                        <div key={item.id} className="flex gap-4 p-4 sm:p-6">
                                            <div className="w-20 h-20 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                                                {imgUrl ? (
                                                    <img src={imgUrl} alt={item.product.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-300 relative text-xs">No image</div>
                                                )}
                                            </div>
                                            <div className="flex flex-col flex-1 pl-1">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="font-medium text-gray-900 line-clamp-1">{item.product.name}</h4>
                                                        <p className="text-sm text-gray-500 mt-1">
                                                            {priceDisplay}{intervalDisplay}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => removeFromCart(item.id)}
                                                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                                        aria-label="Remove item"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <div className="flex items-center justify-between mt-auto pt-2">
                                                    <div className="flex items-center border border-gray-200 rounded-md">
                                                        <button
                                                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                            className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                                                            disabled={item.quantity <= 1}
                                                        >
                                                            <Minus className="w-3.5 h-3.5" />
                                                        </button>
                                                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                                        <button
                                                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                            className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                    <span className="font-medium text-gray-900">
                                                        {new Intl.NumberFormat('en-US', {
                                                            style: 'currency',
                                                            currency: item.price.currency.toUpperCase(),
                                                        }).format((item.price.unit_amount * item.quantity) / 100)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </SlideoutMenu.Content>

                    {items.length > 0 && (
                        <SlideoutMenu.Footer className="flex-col gap-4">
                            <div className="flex justify-between items-center w-full">
                                <span className="text-base font-medium text-gray-900">Subtotal</span>
                                <span className="text-lg font-bold text-gray-900">{formattedTotal}</span>
                            </div>
                            <p className="text-xs text-gray-500">Shipping and taxes calculated at checkout.</p>
                            <Button
                                className="w-full text-base h-12"
                                onPress={() => {
                                    setIsCartOpen(false);
                                    router.push("/checkout");
                                }}
                            >
                                Checkout
                            </Button>
                        </SlideoutMenu.Footer>
                    )}
                </SlideoutMenu.Dialog>
            </SlideoutMenu.Modal>
        </SlideoutMenu.Overlay>
    );
}
