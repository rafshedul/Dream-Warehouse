import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import AuthProvider from "../components/auth-provider";
import CartProvider from "../components/cart-provider";

export const metadata: Metadata = {
  title: "Dream Warehouse · ERP",
  description: "Inventory, warehouse, sales, and purchase management.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col"><Suspense fallback={null}><CartProvider><AuthProvider>{children}</AuthProvider></CartProvider></Suspense></body>
    </html>
  );
}
