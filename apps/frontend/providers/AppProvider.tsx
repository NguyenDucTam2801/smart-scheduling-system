'use client'; // <-- Add this directive at the very top!

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

export default function AppProvider({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <Toaster richColors />
            {children}
        </ThemeProvider>
    );
}