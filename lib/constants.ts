/**
 * Application-wide constants and configuration.
 */

export const APP_CONFIG = {
    name: "Our First App",
    description: "A premium Next.js-inspired boilerplate using Untitled UI and Tailwind CSS.",
    version: "1.0.0",
};

export const BRAND_CONFIG = {
    name: "Befree",
    logo: {
        light: "/logo-blue.png",
        dark: "/logo-highlight.png",
        icon: "/favicon-befree.png",
    },
    theme: {
        primaryColor: "#4146f6", // Brand primary color
    },
};

export const NAVIGATION = {
    main: [
        { name: "Dashboard", href: "dashboard" },
        { name: "Projects", href: "projects" },
        { name: "Users", href: "users" },
        { name: "Settings", href: "settings" },
    ],
    admin: [
        { name: "Users", href: "users" },
        { name: "Roles", href: "roles" },
        { name: "Activity", href: "activity" },
    ],
};

export const AUTH_CONFIG = {
    loginPath: "/login",
    signupPath: "/signup",
    afterLoginPath: "/dashboard",
};
