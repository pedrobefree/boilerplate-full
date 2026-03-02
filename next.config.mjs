/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        optimizePackageImports: [
            "lucide-react",
            "react-feather",
            "recharts",
            "react-aria-components",
            "react-aria",
            "@react-aria/utils",
        ],
    },
};
export default nextConfig;
