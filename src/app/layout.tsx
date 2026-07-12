import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

export const metadata: Metadata = {
  title: "Blue Arc OS",
  description: "CRM platform for modern businesses",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased">
        <Providers>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar />
              <main className="flex-1 overflow-y-auto">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
