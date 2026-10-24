import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
    build: {
        rollupOptions: {
            output: {
                // Big libs ride in their own files, so the app itself stays small
                // and phones cache the rest separately.
                manualChunks(id: string) {
                    if (!id.includes("node_modules")) return undefined;
                    if (id.includes("@supabase")) return "supabase";
                    if (id.includes("dexie")) return "dexie";
                    if (id.includes("framer-motion")) return "motion";
                    if (id.includes("date-fns")) return "dates";
                    if (id.includes("react")) return "react";
                    return "vendor";
                },
            },
        },
    },
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            registerType: "autoUpdate",
            manifest: {
                name: "Hedraios",
                short_name: "Hedraios",
                description: "Daily documentation + faith tracking",
                id: "/",
                start_url: "/",
                scope: "/",
                display: "standalone",
                background_color: "#ffffff",
                theme_color: "#ffffff",
                categories: ["lifestyle", "productivity"],
                icons: [
                    {
                        src: "/pwa-192x192.png",
                        sizes: "192x192",
                        type: "image/png",
                        purpose: "any",
                    },
                    {
                        src: "/pwa-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "any",
                    },
                    {
                        src: "/pwa-maskable-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable",
                    },
                ],
            },
        }),
    ],
});
