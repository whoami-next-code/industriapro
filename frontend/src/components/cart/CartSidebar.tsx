"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle, X, Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart/CartContext";
import { useCartUI } from "@/components/cart/CartUIContext";
import { API_URL, getImageUrl } from "@/lib/api";

type Suggest = { id: number; name: string; price: number; thumbnailUrl?: string; imageUrl?: string; originalPrice?: number };
type ProductDetail = { id: number; name: string; price: number; originalPrice?: number; thumbnailUrl?: string; imageUrl?: string; stock?: number };

export default function CartSidebar() {
  const { items, total, removeItem, setQuantity, addItem } = useCart();
  const { open, closeCart } = useCartUI();
  const [suggestions, setSuggestions] = useState<Suggest[]>([]);
  const [added, setAdded] = useState<ProductDetail | null>(null);
  const [imgFailed, setImgFailed] = useState<Record<number, boolean>>({});

  const lastAddedId = useMemo(() => (items.length ? items[items.length - 1].productId : null), [items]);
  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!lastAddedId) { setSuggestions([]); setAdded(null); return; }
      try {
        const res = await fetch(`${API_URL}/productos/${lastAddedId}`);
        if (res.ok) {
          const prod = await res.json();
          if (!ignore) setAdded({ id: prod.id, name: prod.name, price: Number(prod.price||0), originalPrice: prod.originalPrice, thumbnailUrl: prod.thumbnailUrl, imageUrl: prod.imageUrl, stock: Number(prod.stock||0) });
          const cat = prod?.category || "";
          if (cat) {
            const r2 = await fetch(`${API_URL}/productos?category=${encodeURIComponent(cat)}`);
            if (r2.ok) {
              const data: any[] = await r2.json();
              const mapped = data.filter(p => p.id !== lastAddedId).slice(0, 8).map(p => ({ id: p.id, name: p.name, price: Number(p.price||0), originalPrice: p.originalPrice, thumbnailUrl: p.thumbnailUrl, imageUrl: p.imageUrl }));
              if (!ignore) setSuggestions(mapped);
            } else {
              if (!ignore) setSuggestions([]);
            }
          } else {
            if (!ignore) setSuggestions([]);
          }
        } else {
          if (!ignore) { setAdded(null); setSuggestions([]); }
        }
      } catch {
        if (!ignore) { setAdded(null); setSuggestions([]); }
      }
    }
    load();
    return () => { ignore = true };
  }, [lastAddedId]);

  const lastItemQty = items.find(i => i.productId === lastAddedId)?.quantity ?? 1;
  const imgSrc = (id: number | undefined, u?: string) => {
    if (id && imgFailed[id]) return "/vercel.svg";
    return getImageUrl(u);
  };

  return (
    <div aria-hidden={!open} aria-label="Carrito modal" className="pointer-events-none">
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[80] transition-opacity duration-300 ${open ? "opacity-50" : "opacity-0"} bg-black pointer-events-auto ${open ? "" : "hidden"}`}
        aria-hidden="true"
        onClick={closeCart}
      />
      {/* Modal */}
      <div
        className={`fixed inset-0 z-[90] flex items-start sm:items-center justify-center p-4 ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Producto agregado a tu Carro"
      >
        <div className={`w-full max-w-4xl bg-white rounded-xl shadow-2xl border transform transition-all duration-300 ${open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center">
                <CheckCircle className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-semibold">Producto agregado a tu Carro</h2>
            </div>
            <button onClick={closeCart} aria-label="Cerrar" className="rounded-md border px-3 py-1 text-sm hover:bg-gray-50">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Added product row */}
            {added && (
              <div className="grid grid-cols-[96px_1fr_auto] items-center gap-4">
                <div className="relative w-24 h-24 rounded border overflow-hidden bg-gray-100">
                  <Image
                    src={imgSrc(added.id, added.thumbnailUrl || added.imageUrl)}
                    alt={`${added.name} - imagen del producto`}
                    fill
                    className="object-cover"
                    unoptimized
                    loading="lazy"
                    sizes="96px"
                    onError={() => setImgFailed(prev => ({ ...prev, [added.id]: true }))}
                  />
                </div>
                <div>
                  <div className="text-sm text-gray-500 uppercase">{(added as any).brand || ""}</div>
                  <div className="font-medium text-gray-900 line-clamp-2">{added.name}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="text-2xl font-bold text-gray-900">S/ {added.price.toFixed(2)}</div>
                    {added.originalPrice && (
                      <div className="text-gray-500 line-through">S/ {Number(added.originalPrice).toFixed(2)}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center rounded-md border bg-white">
                    <button onClick={() => setQuantity(added.id, Math.max(1, lastItemQty - 1))} className="px-3 py-2 hover:bg-gray-50" aria-label="Disminuir">
                      <Minus className="w-4 h-4" />
                    </button>
                    <div className="px-3 py-2 w-12 text-center">{lastItemQty}</div>
                    <button onClick={() => setQuantity(added.id, lastItemQty + 1)} className="px-3 py-2 hover:bg-gray-50" aria-label="Aumentar">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-sm text-gray-600">Máximo {added.stock ?? 999} unidades.</div>
                </div>
              </div>
            )}

            {/* Suggestions carousel-like list */}
            <div className="border-t pt-4">
              <div className="font-semibold mb-4">Complementa tu proyecto</div>
              <div className="relative">
                <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
                  {suggestions.map((s) => {
                    const hasDiscount = s.originalPrice && s.originalPrice > s.price;
                    const discountPct = hasDiscount ? Math.round(100 - (s.price / (s.originalPrice as number)) * 100) : null;
                    return (
                      <div key={s.id} className="min-w-[220px] snap-start rounded-lg border bg-white shadow-sm hover:shadow-md transition-shadow">
                        <div className="relative h-36 rounded-t-lg overflow-hidden">
                          <Image
                            src={imgSrc(s.id, s.thumbnailUrl || s.imageUrl)}
                            alt={`${s.name} - imagen del producto`}
                            fill
                            className="object-cover"
                            unoptimized
                            loading="lazy"
                            sizes="144px"
                            onError={() => setImgFailed(prev => ({ ...prev, [s.id]: true }))}
                          />
                          {hasDiscount && (
                            <span className="absolute top-2 left-2 text-xs font-semibold px-2 py-1 rounded bg-red-600 text-white">-{discountPct}%</span>
                          )}
                        </div>
                        <div className="p-3">
                          <div className="text-[11px] text-gray-500 uppercase mb-1">GENERICO</div>
                          <div className="text-sm font-medium line-clamp-2 mb-2">{s.name}</div>
                          <div className="space-y-1">
                            <div className="text-gray-900 font-semibold">S/ {s.price.toFixed(2)}</div>
                            {hasDiscount && (
                              <div className="text-gray-500 line-through">S/ {Number(s.originalPrice).toFixed(2)}</div>
                            )}
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <button
                              onClick={() =>
                                addItem({
                                  productId: s.id,
                                  name: s.name,
                                  price: s.price,
                                  quantity: 1,
                                  imageUrl: s.imageUrl,
                                  thumbnailUrl: s.thumbnailUrl,
                                })
                              }
                              className="text-sm rounded-md border px-3 py-2 hover:bg-gray-50"
                            >
                              Agregar
                            </button>
                            <button onClick={() => removeItem(s.id)} className="text-sm text-red-600 hover:text-red-700 inline-flex items-center gap-1"><Trash2 className="w-4 h-4" />Quitar</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t">
            <div className="px-6 py-3 text-[13px] text-gray-600">
              Los productos de tu carro de compras pueden agotarse próximamente. Cómpralos pronto.
            </div>
            <div className="px-6 py-4 flex items-center justify-between gap-3">
              <Link href="/catalogo" className="text-gray-700 hover:underline">Seguir comprando</Link>
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-700 mr-4">Total: <span className="font-semibold">S/ {total.toFixed(2)}</span></div>
                <Link href="/carrito" className="inline-flex items-center justify-center rounded-md bg-gray-800 text-white px-4 py-2 hover:bg-gray-900">Ir al Carro</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
