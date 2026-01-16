'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Star, ShoppingCart, Eye, Heart } from 'lucide-react';
import { API_URL, apiFetch, BACKEND_URL } from '@/lib/api';
import { useCart } from '@/components/cart/CartContext';
import { useCartUI } from '@/components/cart/CartUIContext';
import { useToast } from '@/components/ui/Toaster';

// Wrapper para el botón de agregar al carrito con estilo personalizado
function AddToCartButtonWrapper({ productId, name, price, imageSrc, disabled }: { productId: number; name: string; price: number; imageSrc: string; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const { addItem, items } = useCart();
  const { openCart } = useCartUI();
  const { show } = useToast();

  const handleClick = async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/productos/${productId}`);
      if (!res.ok) throw new Error('stock_error');
      const p = await res.json();
      const stock = Number(p?.stock ?? 0);
      const current = items.find((i: any) => i.productId === productId)?.quantity ?? 0;
      const desired = current + 1;
      if (stock <= 0 || desired > stock) {
        show('Stock insuficiente');
        return;
      }
      addItem({ 
        productId, 
        name, 
        price, 
        quantity: 1,
        imageUrl: p?.imageUrl,
        thumbnailUrl: p?.thumbnailUrl,
      });
      show(`Se añadió "${name}" al carrito`);
      openCart();
    } catch {
      show('No se pudo validar stock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleClick}
      disabled={loading || disabled}
      className="w-full bg-gray-900 hover:bg-orange-500 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center space-x-2 group focus:outline-none focus:ring-2 focus:ring-orange-500"
      aria-label={`Agregar ${name} al carrito`}
      type="button"
    >
      <ShoppingCart className="w-5 h-5" />
      <span>{loading ? 'Agregando...' : disabled ? 'Sin stock' : 'Agregar al carrito'}</span>
    </button>
  );
}

type ApiProduct = {
  id: number;
  name: string;
  price: number;
  description?: string;
  category?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  stock?: number;
};

type FeaturedProduct = {
  id: number;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  badge?: string;
  badgeColor?: string;
  image: string;
  description: string;
  stock: number;
};

// Función para construir URL de imagen
const buildImageUrl = (url?: string | null): string => {
  if (!url) {
    return 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=industrial%20product%20on%20white%20background&image_size=square';
  }
  if (url.startsWith('http')) return url;
  // Las imágenes estáticas se sirven desde el backend
  return `${BACKEND_URL}${url.startsWith('/') ? url : '/' + url}`;
};

// Función para determinar badge basado en el producto
const getBadge = (product: ApiProduct, index: number): { badge: string; badgeColor: string } | null => {
  if (index === 0) return { badge: 'Más vendido', badgeColor: 'bg-red-500' };
  if (index === 1) return { badge: 'Nuevo', badgeColor: 'bg-green-500' };
  if (index === 2) return { badge: 'Oferta', badgeColor: 'bg-orange-500' };
  if (index === 4) return { badge: 'Descuento', badgeColor: 'bg-blue-500' };
  return null;
};

export default function Home2FeaturedProducts() {
  const [hoveredProduct, setHoveredProduct] = useState<number | null>(null);
  const [products, setProducts] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        const data: ApiProduct[] = await apiFetch('/productos');
        // Tomar los primeros 6 productos
        const featured = data.slice(0, 6).map((p, index) => {
          const badge = getBadge(p, index);
          return {
            id: p.id,
            name: p.name,
            category: p.category || 'Sin categoría',
            price: Number(p.price || 0),
            originalPrice: undefined, // Puedes agregar lógica para calcular descuentos
            rating: 4.5 + Math.random() * 0.5, // Rating simulado (puedes agregar campo real en el futuro)
            reviews: Math.floor(Math.random() * 30) + 10, // Reviews simuladas
            badge: badge?.badge,
            badgeColor: badge?.badgeColor,
            image: buildImageUrl(p.thumbnailUrl || p.imageUrl),
            description: p.description || 'Producto industrial de alta calidad',
            stock: Number(p.stock || 0),
          };
        });
        setProducts(featured);
        setError(null);
      } catch (err) {
        console.error('Error cargando productos destacados:', err);
        setError('No se pudieron cargar los productos');
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 0,
    }).format(price);
  };

  if (loading) {
    return (
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Productos Destacados
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Descubre nuestra selección de productos industriales de alta calidad, 
              diseñados para optimizar tus procesos productivos.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm animate-pulse">
                <div className="h-64 bg-gray-200" />
                <div className="p-6 space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                  <div className="h-6 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-8 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error || products.length === 0) {
    return (
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Productos Destacados
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              {error || 'No hay productos disponibles en este momento'}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Productos Destacados
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Descubre nuestra selección de productos industriales de alta calidad, 
            diseñados para optimizar tus procesos productivos.
          </p>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product, index) => (
            <div
              key={product.id}
              className="bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group"
              onMouseEnter={() => setHoveredProduct(product.id)}
              onMouseLeave={() => setHoveredProduct(null)}
            >
              {/* Product Image */}
              <div className="relative h-64 overflow-hidden">
                <img
                  src={product.image}
                  alt={`${product.name} - ${product.category}`}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                
                {/* Badge */}
                {product.badge && (
                  <div className={`absolute top-4 left-4 ${product.badgeColor} text-white px-3 py-1 rounded-full text-sm font-medium z-10`}>
                    {product.badge}
                  </div>
                )}

                {/* Overlay Actions */}
                <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity duration-300 ${
                  hoveredProduct === product.id ? 'opacity-100' : 'opacity-0'
                }`}>
                  <div className="flex space-x-3">
                    <Link
                      href={`/catalogo/${product.id}`}
                      className="bg-white text-gray-900 p-3 rounded-full hover:bg-orange-500 hover:text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      aria-label={`Ver detalles de ${product.name}`}
                    >
                      <Eye className="w-5 h-5" />
                    </Link>
                    <button 
                      className="bg-orange-500 text-white p-3 rounded-full hover:bg-orange-600 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white"
                      aria-label={`Agregar ${product.name} a favoritos`}
                      type="button"
                    >
                      <Heart className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-6">
                <div className="mb-2">
                  <span className="text-sm text-orange-500 font-medium">{product.category}</span>
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-orange-500 transition-colors">
                  {product.name}
                </h3>
                
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {product.description}
                </p>

                {/* Rating */}
                <div className="flex items-center mb-4">
                  <div className="flex items-center">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < Math.floor(product.rating)
                            ? 'text-yellow-400 fill-current'
                            : i < product.rating
                            ? 'text-yellow-400 fill-current opacity-50'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-gray-600 ml-2">
                    {product.rating} ({product.reviews})
                  </span>
                </div>

                {/* Price */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl font-bold text-gray-900">
                      {formatPrice(product.price)}
                    </span>
                    {product.originalPrice && (
                      <span className="text-lg text-gray-500 line-through">
                        {formatPrice(product.originalPrice)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stock indicator */}
                {product.stock <= 0 && (
                  <div className="mb-4">
                    <span className="text-sm text-red-600 font-medium">Sin stock</span>
                  </div>
                )}

                {/* Add to Cart Button */}
                <div className="w-full">
                  <AddToCartButtonWrapper
                    productId={product.id}
                    name={product.name}
                    price={product.price}
                    imageSrc={product.image}
                    disabled={product.stock <= 0}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View All Products */}
        <div className="text-center mt-12">
          <Link
            href="/catalogo"
            className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold text-lg transition-all duration-300 hover:shadow-lg hover:scale-105 inline-flex items-center"
          >
            Ver catálogo completo
          </Link>
        </div>
      </div>
    </section>
  );
}