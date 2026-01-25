'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, ShoppingCart, User, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/components/cart/CartContext';

export default function Home2Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { items: cartItems, isHydrated } = useCart();
  const cartCount = isHydrated ? cartItems.reduce((sum, item) => sum + item.quantity, 0) : 0;
  const { user, loading, signOut } = useAuth();

  return (
    <header className="bg-white shadow-sm relative z-50">
      {/* Top Bar */}
      <div className="bg-gray-100 border-b">
        <div className="container mx-auto px-4 py-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-6 text-sm text-gray-600">
              <span>+51 987 654 321</span>
              <span>info@industriasp.com</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/cotizacion" 
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1 rounded text-sm font-medium transition-colors"
              >
                Solicitar cotización
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="text-2xl font-bold text-gray-900">
            <span className="text-orange-500">Industria</span>SP
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-8">
            <Link href="/catalogo" className="text-gray-700 hover:text-orange-500 font-medium">
              Catálogo
            </Link>
            <Link href="/mis-pedidos" className="text-gray-700 hover:text-orange-500 font-medium">
              Mis pedidos
            </Link>
            <Link href="/servicios" className="text-gray-700 hover:text-orange-500 font-medium">
              Servicios
            </Link>
            <Link href="/nosotros" className="text-gray-700 hover:text-orange-500 font-medium">
              Nosotros
            </Link>
            <Link href="/contacto" className="text-gray-700 hover:text-orange-500 font-medium">
              Contacto
            </Link>
          </nav>

          {/* Right Side */}
          <div className="flex items-center space-x-4">
            {/* Cart */}
            <Link 
              id="cart-icon" 
              href="/carrito" 
              className="relative p-2 text-gray-700 hover:text-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 rounded"
              aria-label={`Carrito de compras${cartCount > 0 ? ` con ${cartCount} artículo${cartCount !== 1 ? 's' : ''}` : ' vacío'}`}
            >
              <ShoppingCart className="w-6 h-6" />
              {cartCount > 0 && (
                <span 
                  className="absolute -top-1 -right-1 bg-emerald-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold"
                  aria-hidden="true"
                >
                  {cartCount}
                </span>
              )}
            </Link>

            {/* User Authentication */}
            {user ? (
              <div className="flex items-center space-x-2">
                <Link href="/perfil" className="flex items-center space-x-2 p-2 text-gray-700 hover:text-orange-500">
                  <User className="w-6 h-6" />
                  <span className="hidden sm:block text-sm font-medium">
                    {user.email?.split('@')[0]}
                  </span>
                </Link>
                <button
                  onClick={signOut}
                  className="p-2 text-gray-700 hover:text-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 rounded"
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                  type="button"
                >
                  <LogOut className="w-6 h-6" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link 
                  href="/auth/login" 
                  className="text-gray-700 hover:text-orange-500 font-medium text-sm"
                >
                  Iniciar Sesión
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden p-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-500 rounded"
              aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={isMenuOpen}
              type="button"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="lg:hidden bg-white border-t" role="navigation" aria-label="Menú de navegación móvil">
          <div className="container mx-auto px-4 py-4">
            <nav className="flex flex-col space-y-4">
              <Link href="/catalogo" className="text-gray-700 hover:text-orange-500 font-medium" onClick={() => setIsMenuOpen(false)}>
                Catálogo
              </Link>
              <Link href="/servicios" className="text-gray-700 hover:text-orange-500 font-medium" onClick={() => setIsMenuOpen(false)}>
                Servicios
              </Link>
              <Link href="/nosotros" className="text-gray-700 hover:text-orange-500 font-medium" onClick={() => setIsMenuOpen(false)}>
                Nosotros
              </Link>
              <Link href="/contacto" className="text-gray-700 hover:text-orange-500 font-medium" onClick={() => setIsMenuOpen(false)}>
                Contacto
              </Link>
              <Link href="/mis-pedidos" className="text-gray-700 hover:text-orange-500 font-medium" onClick={() => setIsMenuOpen(false)}>
                Mis pedidos
              </Link>
              {user ? (
                <>
                  <Link href="/perfil" className="text-gray-700 hover:text-orange-500 font-medium" onClick={() => setIsMenuOpen(false)}>
                    Mi perfil
                  </Link>
                  <button
                    onClick={() => {
                      signOut();
                      setIsMenuOpen(false);
                    }}
                    className="text-gray-700 hover:text-orange-500 font-medium text-left focus:outline-none focus:ring-2 focus:ring-orange-500 rounded px-2 py-1"
                    type="button"
                  >
                    Cerrar Sesión
                  </button>
                </>
              ) : (
                <>
                  <Link href="/auth/login" className="text-gray-700 hover:text-orange-500 font-medium" onClick={() => setIsMenuOpen(false)}>
                    Iniciar Sesión
                  </Link>
                </>
              )}
              <Link href="/cotizacion" className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded font-medium inline-block" onClick={() => setIsMenuOpen(false)}>
                Solicitar cotización
              </Link>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
