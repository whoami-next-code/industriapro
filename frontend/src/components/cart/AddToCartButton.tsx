"use client";
import React, { useState } from "react";
import { useCart } from "@/components/cart/CartContext";
import { useCartUI } from "@/components/cart/CartUIContext";
import { useToast } from "@/components/ui/Toaster";
import { API_URL } from "@/lib/api";

type Props = {
  productId: number;
  name: string;
  price: number;
  quantity?: number;
  variant?: "primary" | "outline";
  redirectToCart?: boolean; // deprecated: ahora usamos sidebar + toast
  label?: string;
  imageSrc?: string;
  className?: string;
};

export default function AddToCartButton({ productId, name, price, quantity = 1, variant = "primary", redirectToCart = false, label, imageSrc, className }: Props) {
  const { addItem, items } = useCart();
  const { openCart } = useCartUI();
  const { show } = useToast();
  const [loading, setLoading] = useState(false);

  function flyToCart() {
    try {
      const cartEl = document.getElementById("cart-icon");
      if (!cartEl || !imageSrc) return;
      const rectCart = cartEl.getBoundingClientRect();
      const startX = Math.min(Math.max(10, rectCart.left - 80), window.innerWidth - 10);
      const startY = rectCart.top;
      const img = document.createElement("img");
      img.src = imageSrc;
      img.style.position = "fixed";
      img.style.left = `${startX}px`;
      img.style.top = `${startY}px`;
      img.style.width = "40px";
      img.style.height = "40px";
      img.style.borderRadius = "8px";
      img.style.zIndex = "9999";
      img.style.transition = "transform 600ms ease, opacity 600ms ease";
      document.body.appendChild(img);
      const dx = rectCart.left - startX;
      const dy = rectCart.top - startY;
      requestAnimationFrame(() => {
        img.style.transform = `translate(${dx}px, ${dy - 20}px) scale(0.5)`;
        img.style.opacity = "0";
      });
      setTimeout(() => { try { document.body.removeChild(img); } catch {} }, 650);
    } catch {}
  }

  function handleClick() {
    if (loading) return;
    setLoading(true);
    fetch(`${API_URL}/productos/${productId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("stock_error");
        const p = await res.json();
        const stock = Number(p?.stock ?? 0);
        const current = items.find((i) => i.productId === productId)?.quantity ?? 0;
        const desired = current + quantity;
        if (stock <= 0 || desired > stock) {
          show("Stock insuficiente");
          return;
        }
        addItem({ 
          productId, 
          name, 
          price, 
          quantity,
          imageUrl: p?.imageUrl,
          thumbnailUrl: p?.thumbnailUrl,
        });
        show(`Se añadió "${name}" al carrito`);
        flyToCart();
        openCart();
      })
      .catch(() => {
        show("No se pudo validar stock");
      })
      .finally(() => setLoading(false));
  }

  const baseClassName =
    variant === "primary"
      ? "inline-flex items-center justify-center rounded-md bg-black text-white px-3 py-2 text-sm"
      : "inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm";

  const mergedClassName = `${baseClassName} ${className ?? ''} ${loading ? 'opacity-50 pointer-events-none' : ''}`;

  return (
    <button onClick={handleClick} className={mergedClassName} aria-label={`${label ? label : 'Agregar al carrito'} ${name}`} disabled={loading}>
      {label ?? 'Agregar al carrito'}
    </button>
  );
}
