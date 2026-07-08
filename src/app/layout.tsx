import type { Metadata } from "next";
import "./globals.css";
import { AppRegistryProvider } from "@/context/AppRegistryContext";
import { WindowProvider } from "@/context/WindowContext";

export const metadata: Metadata = {
  title: "Blue Arc OS",
  description: "A modern web-based operating system interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full m-0 overflow-hidden">
        <AppRegistryProvider>
          <WindowProvider>{children}</WindowProvider>
        </AppRegistryProvider>
      </body>
    </html>
  );
}
