import { API_URL } from "@/lib/api";
import Link from "next/link";
import { redirect } from "next/navigation";
import ProductDetailClient from "./ProductDetailClient";

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

async function getProduct(id: string): Promise<Product | null> {
  try {
    const [productRes, allRes] = await Promise.all([
      fetch(`${API_URL}/productos/${id}`, { cache: 'no-store' }),
      fetch(`${API_URL}/productos`, { cache: 'no-store' }),
    ]);
    const all = allRes.ok ? await allRes.json() : [];
    let product = null;
    if (productRes.ok) {
      product = await productRes.json();
    }
    if (!product && Array.isArray(all)) {
      product = all.find((p: Product) => p.id === Number(id)) ?? null;
    }
    if (!product) return null;
    const related = Array.isArray(all)
      ? all
          .filter((p: Product) => p.id !== Number(id))
          .filter((p: Product) => !product.category || p.category === product.category)
          .slice(0, 4)
      : [];
    const recommended = Array.isArray(all)
      ? all.filter((p: Product) => p.id !== Number(id)).slice(0, 6)
      : [];
    return { ...product, related, recommended };
  } catch {
    return null;
  }
}

export default async function ProductDetail({
  params,
}: {
  params: { id: string };
}) {
  const product = await getProduct(params.id);

  if (!product) {
    redirect("/catalogo");
  }

  return <ProductDetailClient product={product} />;
}
