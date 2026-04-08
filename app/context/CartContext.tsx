"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { type ProductWithDetails } from "@/app/actions/products";

export interface CartItem {
    id: string; // unique identifier for the cart item (usually price_id)
    product: ProductWithDetails;
    price: NonNullable<ProductWithDetails['prices']>[0];
    quantity: number;
}

interface CartContextType {
    items: CartItem[];
    addToCart: (product: ProductWithDetails, price: NonNullable<ProductWithDetails['prices']>[0]) => void;
    updateQuantity: (id: string, quantity: number) => void;
    removeFromCart: (id: string) => void;
    clearCart: () => void;
    totalItems: number;
    totalPrice: number;
    isCartOpen: boolean;
    setIsCartOpen: (isOpen: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from local storage on mount
    useEffect(() => {
        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
            try {
                setItems(JSON.parse(savedCart));
            } catch (e) {
                console.error("Failed to parse cart from local storage", e);
            }
        }
        setIsLoaded(true);
    }, []);

    // Save to local storage whenever items change
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem('cart', JSON.stringify(items));
        }
    }, [items, isLoaded]);

    const addToCart = useCallback((product: ProductWithDetails, price: NonNullable<ProductWithDetails['prices']>[0]) => {
        setItems(prev => {
            const existingItem = prev.find(item => item.id === price.id);
            if (existingItem) {
                return prev.map(item =>
                    item.id === price.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { id: price.id, product, price, quantity: 1 }];
        });
        setIsCartOpen(true);
    }, []);

    const updateQuantity = useCallback((id: string, quantity: number) => {
        if (quantity < 1) return;
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, quantity } : item
        ));
    }, []);

    const removeFromCart = useCallback((id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    }, []);

    const clearCart = useCallback(() => {
        setItems([]);
    }, []);

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = items.reduce((sum, item) => sum + (item.price.unit_amount * item.quantity), 0);

    return (
        <CartContext.Provider value={{
            items,
            addToCart,
            updateQuantity,
            removeFromCart,
            clearCart,
            totalItems,
            totalPrice,
            isCartOpen,
            setIsCartOpen
        }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
