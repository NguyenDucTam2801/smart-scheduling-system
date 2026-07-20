import { ThemeProvider } from "next-themes";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

export default function AppProvider({ children }: { children: React.ReactNode }) {
    const queryClient = new QueryClient();

    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <QueryClientProvider client={queryClient}>
                <Toaster richColors />
                <ReactQueryDevtools initialIsOpen={false} />
                {children}
            </QueryClientProvider>
        </ThemeProvider>
    );
}