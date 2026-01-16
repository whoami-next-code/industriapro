"use client";
import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, Package, Tag, Heart, Share2, ExternalLink } from "lucide-react";
import { useCart, CartItem } from "@/components/cart/CartContext";
import { apiFetch, API_URL, getImageUrl } from "@/lib/api";

type Product = {
  id: number;
  name: string;
  price: number;
  stock: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  category?: string;
  description?: string;
  originalPrice?: number;
};

type Props = {
  onValidate?: (ok: boolean) => void;
  onRemoveFeedback?: (name: string) => void;
  onQuantityFeedback?: (name: string) => void;
  onSelectionChange?: (ids: number[]) => void;
};

export default function CartView({ onValidate, onRemoveFeedback, onQuantityFeedback, onSelectionChange }: Props) {
  const { items, total, removeItem, setQuantity, isHydrated } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [imgFailed, setImgFailed] = useState<Record<number, boolean>>({});


  // Selección por defecto: todos los ítems
  useEffect(() => {
    if (!isHydrated) return;
    const allIds = items.map(i => i.productId);
    setSelectedIds(allIds);
    if (onSelectionChange) onSelectionChange(allIds);
  }, [items, isHydrated]);

  // Cargar info de productos (imagenes y stock)
  useEffect(() => {
    async function load() {
      setLoadingProducts(true);
      try {
        const data = await apiFetch('/productos');
        setProducts(Array.isArray(data) ? data : []);
      } finally {
        setLoadingProducts(false);
      }
    }
    load();
  }, []);

  const prodMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);

  // Validación de stock para ítems seleccionados
  useEffect(() => {
    const errs: Record<number, string> = {};
    for (const it of items) {
      if (!selectedIds.includes(it.productId)) continue;
      const p = prodMap.get(it.productId);
      const stock = Number(p?.stock ?? 0);
      if (stock <= 0) errs[it.productId] = "Sin stock disponible";
      else if (it.quantity > stock) errs[it.productId] = `Stock insuficiente (máximo: ${stock})`;
    }
    setErrors(errs);
    if (onValidate) onValidate(Object.keys(errs).length === 0);
  }, [items, selectedIds, prodMap, onValidate]);

  const selectedItems = useMemo(() => items.filter(i => selectedIds.includes(i.productId)), [items, selectedIds]);
  const selectedTotal = useMemo(() => selectedItems.reduce((s, i) => s + i.price * i.quantity, 0), [selectedItems]);

  function toggleSelectAll() {
    if (selectedIds.length === items.length) setSelectedIds([]);
    else setSelectedIds(items.map(i => i.productId));
    if (onSelectionChange) onSelectionChange(selectedIds.length === items.length ? [] : items.map(i => i.productId));
  }

  function toggleItem(id: number) {
    setSelectedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      if (onSelectionChange) onSelectionChange(next);
      return next;
    });
  }

  function handleQtyChange(it: CartItem, newQty: number) {
    const p = prodMap.get(it.productId);
    const stock = Number(p?.stock ?? 999);
    const qty = Math.max(1, Math.min(newQty, stock));
    setQuantity(it.productId, qty);
    if (onQuantityFeedback) onQuantityFeedback(it.name);
  }

  function handleRemove(it: CartItem) {
    removeItem(it.productId);
    if (onRemoveFeedback) onRemoveFeedback(it.name);
  }

  function toggleFavorite(id: number) {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const getImageSrc = (p?: Product) => {
    const url = p?.thumbnailUrl || p?.imageUrl;
    const id = p?.id;
    // Debug log
    console.log(`[CartView] Product ${id}: url=${url}, fullUrl=${getImageUrl(url)}`);
    
    // Si no hay ID, o la imagen falló, o no hay URL, devolvemos null para que se renderice el fallback
    if (id && imgFailed[id]) return null;
    if (!url) return null;
    return getImageUrl(url);
  };


  // Evitar parpadeo/mismatch durante la hidratación
  if (!isHydrated) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Carrito</h2>
        </div>
        <div className="text-sm text-zinc-600">Cargando carrito…</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2">
        <h2 className="text-lg font-semibold">Carrito</h2>
        {items.length > 0 && (
          <button 
            onClick={toggleSelectAll} 
            className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline"
          >
            {selectedIds.length === items.length ? "Deseleccionar todo" : "Seleccionar todo"}
          </button>
        )}
      </div>

      {items.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">Tu carrito está vacío</p>
          <Link 
            href="/catalogo" 
            className="inline-block mt-4 text-blue-600 hover:text-blue-700 font-medium"
          >
            Explorar productos
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {items.map((it) => {
          const p = prodMap.get(it.productId);
          const stock = Number(p?.stock ?? 0);
          const err = errors[it.productId];
          const isSelected = selectedIds.includes(it.productId);
          const isFavorite = favorites.has(it.productId);
          const hasDiscount = p?.originalPrice && p.originalPrice > it.price;
          const discountPct = hasDiscount ? Math.round(100 - (it.price / (p.originalPrice as number)) * 100) : null;
          const subtotal = it.price * it.quantity;

          return (
            <div 
              key={it.productId} 
              className={`relative rounded-lg border-2 transition-all duration-200 ${
                isSelected 
                  ? "border-blue-500 bg-blue-50/50 shadow-sm" 
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              {/* Etiqueta de descuento */}
              {hasDiscount && (
                <div className="absolute top-3 right-3 z-10">
                  <span className="inline-flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md">
                    <Tag className="w-3 h-3" />
                    -{discountPct}%
                  </span>
                </div>
              )}

              <div className="p-4 sm:p-6">
                <div className="flex gap-4">
                  {/* Checkbox */}
                  <div className="flex-shrink-0 pt-1">
                    <label className="flex items-center cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={isSelected} 
                        onChange={() => toggleItem(it.productId)}
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="sr-only">Seleccionar {it.name}</span>
                    </label>
                  </div>

                  {/* Imagen */}
                  <div className="flex-shrink-0">
                    <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 group">
                      {getImageSrc(p) ? (
                        <Image
                          src={getImageSrc(p)!}
                          alt={`${it.name} - imagen del producto`}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          sizes="(max-width: 640px) 96px, 128px"
                          quality={80}
                          unoptimized={true}
                          onError={() => {
                            const id = p?.id ?? it.productId;
                            setImgFailed(prev => ({ ...prev, [id]: true }));
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center text-gray-400 bg-gray-100">
                           <Package className="h-8 w-8 mb-1" />
                           <span className="text-[10px] font-medium">Sin imagen</span>
                        </div>
                      )}
                      {stock <= 5 && stock > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 bg-orange-500 text-white text-xs text-center py-1 font-semibold">
                          ¡Últimas {stock} unidades!
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Información del producto */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div>
                      <Link 
                        href={`/catalogo?producto=${it.productId}`}
                        className="font-semibold text-gray-900 hover:text-blue-600 line-clamp-2 flex items-start gap-1 group"
                      >
                        {it.name}
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                      </Link>
                      {p?.category && (
                        <p className="text-sm text-gray-500 mt-1">{p.category}</p>
                      )}
                    </div>

                    {/* Precio */}
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-2xl font-bold text-gray-900">
                        ${it.price.toFixed(2)}
                      </span>
                      {hasDiscount && (
                        <span className="text-sm text-gray-500 line-through">
                          ${Number(p.originalPrice).toFixed(2)}
                        </span>
                      )}
                      <span className="text-sm text-gray-600">
                        / unidad
                      </span>
                    </div>

                    {/* Stock */}
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="w-4 h-4 text-gray-400" />
                      {loadingProducts ? (
                        <span className="text-gray-400">Verificando stock...</span>
                      ) : (
                        <span className={`font-medium ${stock > 10 ? 'text-green-600' : stock > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                          {stock > 0 ? `${stock} disponibles` : 'Sin stock'}
                        </span>
                      )}
                    </div>

                    {/* Error de validación */}
                    {err && (
                      <div className="inline-flex items-center gap-2 text-sm bg-red-50 text-red-700 px-3 py-1.5 rounded-md border border-red-200">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        {err}
                      </div>
                    )}
                  </div>
                </div>

                {/* Acciones */}
                <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between gap-4 flex-wrap">
                  {/* Control de cantidad */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 font-medium">Cantidad:</span>
                    <div className="inline-flex items-center rounded-lg border-2 border-gray-300 bg-white shadow-sm">
                      <button 
                        onClick={() => handleQtyChange(it, it.quantity - 1)}
                        disabled={it.quantity <= 1}
                        className="px-3 py-2 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label="Disminuir cantidad"
                      >
                        <Minus className="w-4 h-4 text-gray-700" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={stock}
                        value={it.quantity}
                        onChange={e => handleQtyChange(it, Number(e.target.value) || 1)}
                        className="w-16 text-center py-2 border-x-2 border-gray-300 font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        aria-label={`Cantidad de ${it.name}`}
                      />
                      <button 
                        onClick={() => handleQtyChange(it, it.quantity + 1)}
                        disabled={it.quantity >= stock}
                        className="px-3 py-2 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label="Aumentar cantidad"
                      >
                        <Plus className="w-4 h-4 text-gray-700" />
                      </button>
                    </div>
                  </div>

                  {/* Subtotal y acciones */}
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Subtotal</div>
                      <div className="text-xl font-bold text-gray-900">
                        ${subtotal.toFixed(2)}
                      </div>
                    </div>

                    {/* Botones de acción */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleFavorite(it.productId)}
                        className={`p-2 rounded-lg border transition-all ${
                          isFavorite 
                            ? 'border-red-500 bg-red-50 text-red-600' 
                            : 'border-gray-300 hover:border-red-500 hover:bg-red-50 text-gray-400 hover:text-red-600'
                        }`}
                        aria-label="Guardar para después"
                        title="Guardar para después"
                      >
                        <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleRemove(it)}
                        className="p-2 rounded-lg border border-gray-300 hover:border-red-500 hover:bg-red-50 text-gray-600 hover:text-red-600 transition-all"
                        aria-label="Eliminar del carrito"
                        title="Eliminar del carrito"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {items.length > 0 && (
        <div className="border-t-2 border-gray-200 rounded-lg p-4 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-gray-600">
              Total del carrito: <span className="font-bold text-gray-900 text-lg">${total.toFixed(2)}</span>
            </div>
            <div className={`text-sm ${selectedTotal > 0 ? 'text-blue-600' : 'text-gray-500'}`}>
              Total seleccionado: <span className="font-bold text-lg">${selectedTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
