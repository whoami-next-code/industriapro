

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star, Heart, Eye, X } from 'lucide-react';
import { API_URL, BACKEND_URL } from '@/lib/api';
import AddToCartButton from '@/components/cart/AddToCartButton';

type ProductCategory = 'featured' | 'latest' | 'bestseller';

type ApiProduct = { id: number; name: string; price: number; imageUrl?: string; thumbnailUrl?: string; category?: string; description?: string };
type Product = { id: number; name: string; price: number; originalPrice?: number; image: string; tab: ProductCategory; catLabel?: string; isNew?: boolean; rating?: number; description?: string };

const imgSrc = (u?: string) => {
  if (!u) return 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=industrial%20product%20on%20white%20background&image_size=square';
  if (u.startsWith('http')) return u;
  // Usar BACKEND_URL para rutas relativas
  if (u.startsWith('/')) return `${BACKEND_URL}${u}`;
  return `${BACKEND_URL}/${u}`;
};

const toCard = (p: ApiProduct): Product => ({
  id: p.id,
  name: p.name,
  price: Number(p.price ?? 0),
  image: imgSrc(p.thumbnailUrl || p.imageUrl),
  tab: (['featured','latest','bestseller'] as const).includes((p.category || '').toLowerCase() as ProductCategory)
    ? ((p.category || '').toLowerCase() as ProductCategory)
    : 'featured',
  catLabel: p.category || '',
  isNew: false,
  rating: 4,
  description: p.description,
});

type Category = { id: number; name: string };

function ProductCard({ product, onQuickView }: { product: Product; onQuickView: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/638fba18-ebc9-4dbf-9020-8d680af003ce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'H1',location:'catalogo/page.tsx:ProductCard',message:'render product card',data:{id:product.id,name:product.name},timestamp:Date.now()})}).catch(()=>{});
  }, [product.id]);
  // #endregion
  return (
    <div className="group relative bg-white rounded-lg shadow-sm hover:shadow-lg transition-shadow duration-300 overflow-hidden flex flex-col h-full">
      <Link href={`/catalogo/${product.id}`} className="relative aspect-square overflow-hidden block">
        <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        {product.isNew && (<span className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded">NUEVO</span>)}
        {product.originalPrice && (<span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">OFERTA</span>)}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex space-x-2">
            <button onClick={(e) => { e.preventDefault(); onQuickView(product.id); }} className="bg-white p-2 rounded-full shadow-md hover:bg-gray-100 transition-colors" aria-label="Vista rápida"><Eye className="h-4 w-4 text-gray-700" /></button>
            <button onClick={(e) => { e.preventDefault(); }} className="bg-white p-2 rounded-full shadow-md hover:bg-gray-100 transition-colors" aria-label="Favoritos"><Heart className="h-4 w-4 text-gray-700" /></button>
          </div>
        </div>
      </Link>
      <div className="p-4 flex flex-col flex-1">
        <Link href={`/catalogo/${product.id}`} className="font-semibold text-gray-900 mb-2 line-clamp-2 hover:text-blue-600">
          {product.name}
        </Link>
        <div className="flex items-center mb-2">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className={`h-4 w-4 ${i < Math.floor(product.rating || 0) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
          ))}
        </div>
        {product.description && (
          <div className="mb-3 text-sm text-gray-700 flex-1">
            <div className="whitespace-pre-line line-clamp-3">
              {product.description}
            </div>
          </div>
        )}
        <div className="mt-auto space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold text-gray-900">${product.price}</span>
            {product.originalPrice && (<span className="text-sm text-gray-500 line-through ml-2">${product.originalPrice}</span>)}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <AddToCartButton productId={product.id} name={product.name} price={product.price} label="Comprar" imageSrc={product.image} className="w-full text-xs py-2" />
            <Link 
              href={`/cotizacion?productId=${product.id}&name=${encodeURIComponent(product.name)}&image=${encodeURIComponent(product.image)}`}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cotizar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CatalogPage() {
  const [activeTab, setActiveTab] = useState<'featured'|'latest'|'bestseller'>('featured');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [sort, setSort] = useState<'relevance'|'price_asc'|'price_desc'>('relevance');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [quickId, setQuickId] = useState<number | null>(null);
  const [quickData, setQuickData] = useState<ApiProduct | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await fetch(`${API_URL}/categorias`);
        const data: Category[] = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      } catch {
        setCategories([]);
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadQuick() {
      if (!quickId) { setQuickData(null); return; }
      try {
        const res = await fetch(`${API_URL}/productos/${quickId}`);
        if (!res.ok) { setQuickData(null); return; }
        const data: ApiProduct = await res.json();
        if (!ignore) setQuickData(data);
      } catch {
        if (!ignore) setQuickData(null);
      }
    }
    loadQuick();
    return () => { ignore = true };
  }, [quickId]);

  useEffect(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set('q', search.trim());
        const ac = activeCategory === 'ALL' ? '' : activeCategory;
        if (ac) params.set('category', ac);
        const url = `${API_URL}/productos${params.toString() ? `?${params.toString()}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) {
          const errorText = await res.text();
          console.error('[Catalogo] Error loading productos:', res.status, res.statusText, errorText);
          setProducts([]);
          return;
        }
        const data: ApiProduct[] = await res.json();
        let mapped = data.map(toCard);
        if (sort === 'price_asc') mapped = mapped.sort((a,b) => a.price - b.price);
        else if (sort === 'price_desc') mapped = mapped.sort((a,b) => b.price - a.price);
        setProducts(mapped);
      } catch (err) {
        console.error('[Catalogo] Exception loading productos:', err);
        setProducts([]);
      }
    };
    load();
  }, [search, activeCategory, sort]);

  const getProductsByTab = (tab: ProductCategory) => {
    const base = products.filter(p => p.tab === tab || tab === 'featured');
    return base.filter(p => {
      const matchesSearch = search ? p.name.toLowerCase().includes(search.toLowerCase()) : true;
      const matchesCategory = activeCategory === 'ALL' ? true : (p.catLabel || '').toLowerCase() === activeCategory.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <aside className="lg:col-span-1">
              <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="bg-red-500 text-white font-semibold px-4 py-3 uppercase tracking-wide flex items-center gap-2">
                  <span className="inline-block w-4 h-0.5 bg-white mr-1" /> Todas las categorías
                </div>
                <ul className="divide-y divide-gray-100">
                  {[{ id: 0, name: 'ALL' }, ...categories].map((cat) => (
                    <li key={`cat-${(cat as any).id ?? (cat as any).name}`}>
                      <button className={`w-full text-left px-4 py-3 flex items-center justify-between ${activeCategory===cat.name?'font-semibold text-gray-900 bg-gray-50':'text-gray-700'}`} onClick={()=>setActiveCategory(cat.name)} aria-pressed={activeCategory===cat.name}>
                        <span className="flex items-center gap-3 uppercase text-sm">
                          <span className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 inline-flex items-center justify-center text-gray-400">•</span>
                          {cat.name === 'ALL' ? 'Todas' : cat.name}
                        </span>
                        {cat.name === 'DESKTOPS' || cat.name === 'COMPONENTS' ? (<span className="text-gray-400">›</span>) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>

            <div className="lg:col-span-3">
              <div className="flex items-center gap-3 mb-6">
                <input type="search" placeholder="Buscar productos" value={search} onChange={(e)=>setSearch(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Buscar productos" />
                <select value={sort} onChange={(e)=>setSort(e.target.value as any)} className="border border-gray-300 rounded-lg px-3 py-2">
                  <option value="relevance">Relevancia</option>
                  <option value="price_asc">Precio: menor a mayor</option>
                  <option value="price_desc">Precio: mayor a menor</option>
                </select>
              </div>
              <div className="flex justify-between items-center mb-6">
                <div className="bg-gray-100 rounded-lg p-1 flex">
                  {(['featured','latest','bestseller'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-3 rounded-md font-medium transition-colors ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`} aria-pressed={activeTab===tab}>
                      {tab === 'featured' ? 'Destacados' : tab === 'latest' ? 'Novedades' : 'Más vendidos'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {getProductsByTab(activeTab).map((product) => (
                  <ProductCard key={product.id} product={product} onQuickView={(id)=>{ setQuickId(id); setQuickOpen(true); }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      {quickOpen && (
        <div className="fixed inset-0 z-[80]">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setQuickOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="font-semibold">Detalles del producto</div>
                <button onClick={()=>setQuickOpen(false)} aria-label="Cerrar" className="rounded border px-3 py-1 text-sm"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="aspect-square bg-gray-100 rounded overflow-hidden">
                  <img src={imgSrc(quickData?.thumbnailUrl || quickData?.imageUrl)} alt={quickData?.name || ''} className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="text-lg font-semibold mb-2">{quickData?.name || 'Producto'}</div>
                  <div className="text-2xl font-bold mb-2">${Number(quickData?.price||0).toFixed(2)}</div>
                  <div className="text-sm text-zinc-600 mb-4">{(quickData as any)?.description || ''}</div>
                  <div className="flex flex-col gap-3">
                    {quickData && (
                      <>
                        <AddToCartButton productId={quickData.id} name={quickData.name} price={Number(quickData.price||0)} label="Comprar" imageSrc={imgSrc(quickData?.thumbnailUrl || quickData?.imageUrl)} />
                        <Link 
                          href={`/cotizacion?productId=${quickData.id}&name=${encodeURIComponent(quickData.name)}&image=${encodeURIComponent(imgSrc(quickData?.thumbnailUrl || quickData?.imageUrl))}`}
                          className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => setQuickOpen(false)}
                        >
                          Cotizar este producto
                        </Link>
                        <Link href={`/catalogo/${quickData.id}`} className="text-sm text-blue-600 hover:underline text-center" onClick={() => setQuickOpen(false)}>
                          Ver detalles completos
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
