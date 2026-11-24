"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type CartProduct = { id: number; name: string; sku: string; unit_price: number; quantity: number };
type CartContextValue = {
  items: CartProduct[];
  count: number;
  add: (product: Omit<CartProduct, "quantity">, quantity?: number) => void;
  setQuantity: (id: number, quantity: number) => void;
  remove: (id: number) => void;
  update: (id: number, patch: Partial<Pick<CartProduct, "name" | "unit_price">>) => void;
  clear: () => void;
};
const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "dream-warehouse-cart-v1";

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used within CartProvider");
  return value;
}

export default function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartProduct[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setItems(parsed.filter((item) => Number.isInteger(item.id) && Number.isInteger(item.quantity) && item.quantity > 0 && typeof item.name === "string" && Number.isFinite(Number(item.unit_price))).map((item) => ({ id: item.id, name: item.name, sku: String(item.sku ?? ""), unit_price: Number(item.unit_price), quantity: Math.min(5000, item.quantity) })));
        }
      } catch { localStorage.removeItem(STORAGE_KEY); }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }, [items, ready]);
  const add = useCallback((product: Omit<CartProduct, "quantity">, quantity = 1) => setItems((current) => {
    const existing = current.find((item) => item.id === product.id);
    if (existing) return current.map((item) => item.id === product.id ? { ...product, quantity: Math.min(5000, item.quantity + quantity) } : item);
    return [...current, { ...product, quantity: Math.min(5000, quantity) }];
  }), []);
  const setQuantity = useCallback((id: number, rawQuantity: number) => setItems((current) => { const quantity = Math.floor(rawQuantity); return !Number.isFinite(quantity) ? current : quantity <= 0 ? current.filter((item) => item.id !== id) : current.map((item) => item.id === id ? { ...item, quantity: Math.min(5000, quantity) } : item); }), []);
  const remove = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const update = useCallback((id: number, patch: Partial<Pick<CartProduct, "name" | "unit_price">>) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item)), []);
  const clear = useCallback(() => setItems([]), []);
  const value = useMemo(() => ({ items, count: items.reduce((sum, item) => sum + item.quantity, 0), add, setQuantity, remove, update, clear }), [items, add, setQuantity, remove, update, clear]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
