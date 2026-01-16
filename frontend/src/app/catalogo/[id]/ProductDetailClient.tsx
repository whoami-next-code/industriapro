'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import AddToCartButton from '@/components/cart/AddToCartButton';
import { API_URL, getImageUrl } from '@/lib/api';

type Product = {
  id: number;
  name: string;
  description?: string;
  price: number;
  category?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  stock?: number;
  specs?: Record<string, string>;
  mediaUrls?: string[];
  related?: Product[];
  recommended?: Product[];
};

function buildSrc(path?: string | null) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  // Si la URL empieza con /, usar el backend directamente (puerto 3001)
  if (path.startsWith('/')) return `http://localhost:3001${path}`;
  return `${API_URL}/${path}`;
}

export default function ProductDetailClient({ product }: { product: Product }) {
  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/638fba18-ebc9-4dbf-9020-8d680af003ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H2',location:'catalogo/[id]/ProductDetailClient',message:'render product detail',data:{id:product.id,name:product.name},timestamp:Date.now()})}).catch(()=>{});
  }, [product.id]);
  // #endregion
  const images = useMemo(() => {
    const arr: string[] = [];
    const main = buildSrc(product.imageUrl || product.thumbnailUrl);
    if (main) arr.push(main);
    (product.mediaUrls || []).forEach((m) => {
      const src = buildSrc(m);
      if (src) arr.push(src);
    });
    return arr.length ? arr : ['/window.svg'];
  }, [product.imageUrl, product.thumbnailUrl, product.mediaUrls]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [frame, setFrame] = useState(0);

  const activeImage = images[activeIndex] ?? images[0];
  const frameImage = images[(frame + images.length) % images.length] ?? activeImage;

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          {/* Galería con zoom */}
          <div
            className="aspect-video rounded-xl bg-zinc-100 overflow-hidden relative group border border-zinc-200"
            onMouseMove={(e) => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const x = ((e.clientX - rect.left) / rect.width) * 100;
              const y = ((e.clientY - rect.top) / rect.height) * 100;
              setZoomPos({ x, y });
            }}
          >
            <div
              className="absolute inset-0 transition-transform duration-200 group-hover:scale-110"
              style={{
                backgroundImage: `url(${activeImage})`,
                backgroundSize: 'cover',
                backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
              }}
              aria-label="Zoom de producto"
            />
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={`h-20 w-24 flex-shrink-0 overflow-hidden rounded border ${
                  activeIndex === idx ? 'border-blue-600 ring-2 ring-blue-100' : 'border-zinc-200'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img}
                  alt={`Vista ${idx + 1}`}
                  className="h-full w-full object-cover"
                  loading={idx === 0 ? 'eager' : 'lazy'}
                />
              </button>
            ))}
          </div>

          {/* Vista 360° (placeholder simple con slider de frames) */}
          <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/60 p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-semibold text-blue-900">Vista 360°</p>
                <p className="text-xs text-blue-700">Gira para explorar el producto (placeholder en espera de assets 360°)</p>
              </div>
              <span className="text-xs text-blue-700">Frame {frame + 1} / {images.length}</span>
            </div>
            <div className="aspect-video bg-white rounded-lg border overflow-hidden flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={frameImage} alt="Vista 360" className="h-full w-full object-contain" loading="lazy" />
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(images.length - 1, 0)}
              value={frame}
              onChange={(e) => setFrame(Number(e.target.value))}
              className="w-full mt-3 accent-blue-600"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">{product.name}</h1>
            {product.category && (
              <div className="text-sm text-zinc-600">Categoría: {product.category}</div>
            )}
            <div className="text-2xl font-semibold text-emerald-700">${product.price}</div>
            {typeof product.stock === 'number' && (
              <div className="text-sm text-zinc-700">Stock: {product.stock}</div>
            )}
          </div>
          <p className="text-zinc-700 whitespace-pre-line leading-relaxed">
            {product.description || 'Sin descripción disponible.'}
          </p>

          {product.specs && (
            <div className="rounded-lg border bg-white p-4">
              <h2 className="font-semibold mb-2">Especificaciones técnicas</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {Object.entries(product.specs).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-zinc-600">{k}</dt>
                    <dd className="font-medium text-zinc-900 text-right">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            <AddToCartButton
              productId={product.id}
              name={product.name}
              price={product.price}
              label="Comprar ahora"
            />
            <Link
              href={`/cotizacion?productId=${product.id}&name=${encodeURIComponent(product.name)}&image=${encodeURIComponent(product.imageUrl ?? '')}`}
              className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm hover:bg-zinc-50"
            >
              Cotizar
            </Link>
          </div>

          <div>
            <Link href="/catalogo" className="text-sm underline">
              Volver al catálogo
            </Link>
          </div>
        </div>
      </div>

      {/* Productos relacionados */}
      {product.related && product.related.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Relacionados</h2>
            <Link href="/catalogo" className="text-sm text-blue-700 underline">
              Ver todo
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {product.related.map((item) => (
              <Link
                key={item.id}
                href={`/catalogo/${item.id}`}
                className="rounded-lg border bg-white p-3 hover:shadow-md transition"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getImageUrl(item.thumbnailUrl || item.imageUrl)}
                  alt={item.name}
                  className="h-36 w-full object-cover rounded mb-2"
                  loading="lazy"
                />
                <div className="font-semibold text-sm">{item.name}</div>
                <div className="text-xs text-zinc-600">{item.category}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recomendaciones personalizadas */}
      {product.recommended && product.recommended.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recomendaciones</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {product.recommended.slice(0, 3).map((item) => (
              <Link
                key={item.id}
                href={`/catalogo/${item.id}`}
                className="rounded-lg border bg-white p-4 hover:shadow-md transition flex gap-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getImageUrl(item.thumbnailUrl || item.imageUrl)}
                  alt={item.name}
                  className="h-20 w-20 object-cover rounded"
                  loading="lazy"
                />
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-sm text-emerald-700">${item.price}</div>
                  <p className="text-xs text-zinc-600 line-clamp-2">{item.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

