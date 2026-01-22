'use client';

import Head from 'next/head';
import { AuthProvider } from '@/contexts/AuthContext';
import Home2Header from '@/components/home/Home2Header';
import Home2Hero from '@/components/home/Home2Hero';
import Home2Services from '@/components/home/Home2Services';
import Home2WhyChoose from '@/components/home/Home2WhyChoose';
import Home2Projects from '@/components/home/Home2Projects';
import Home2Team from '@/components/home/Home2Team';

import { CartProvider } from '@/components/cart/CartContext';

export default function IndexPage() {
  return (
    <AuthProvider>
      <CartProvider>
        <div>
          <Head>
            <title>Industrias SP – Home 2</title>
            <meta name="description" content="Página principal basada en la plantilla Home 2, optimizada y compatible con el entorno actual." />
            <meta property="og:locale" content="es_MX" />
          </Head>
          <Home2Header />
          <main>
            <Home2Hero />
            <Home2Services />
            <Home2WhyChoose />
            <Home2Projects />
            <Home2Team />
          </main>
        </div>
      </CartProvider>
    </AuthProvider>
  );
}
