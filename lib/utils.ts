import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { type ComponentType, isValidElement } from "react";

/**
 * Merges class names using clsx and tailwind-merge.
 * This is the preferred way to handle dynamic Tailwind classes.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Alias for cn, maintained for backward compatibility.
 */
export const cx = cn;

/**
 * Identity function for style objects to provide type inference.
 */
export const sortCx = <T>(styles: T): T => styles;

/**
 * Checks if the given value is a React component (class or functional).
 */
export function isReactComponent(value: unknown): value is ComponentType<Record<string, unknown>> {
    return (
        typeof value === "function" ||
        (typeof value === "object" && value !== null && "$$typeof" in value && value.$$typeof === Symbol.for("react.element")) ||
        isValidElement(value)
    );
}

/**
 * Generates a URL-friendly slug from a string.
 */
export function slugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .normalize("NFD") // Remove accents
        .replace(/[\u0300-\u036f]/g, "") // Remove accent characters
        .replace(/[^a-z0-9\s-]/g, "") // Remove non-alphanumeric (except spaces/hyphens)
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .replace(/-+/g, "-") // Remove multiple hyphens
        .replace(/^-+/, "") // Trim leading hyphens
        .replace(/-+$/, ""); // Trim trailing hyphens
}

