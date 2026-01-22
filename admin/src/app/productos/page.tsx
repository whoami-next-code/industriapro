'use client';

import { useEffect, useState } from 'react';
import { apiFetch, API_URL } from '@/lib/api';
import Protected from '@/lib/Protected';
import AdvancedTable from '@/components/tables/AdvancedTable';
import Modal from '@/components/modals/Modal';
import ConfirmDialog from '@/components/modals/ConfirmDialog';
import toast from 'react-hot-toast';
import { ColumnDef } from '@tanstack/react-table';
import { PencilIcon, TrashIcon, PlusIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { useAppStore } from '@/store/useAppStore';

type Product = {
  id: number;
  nombre: string;
  precio: number;
  stock: number;
  categoria?: { id: number; nombre: string };
  imagenUrl?: string;
  descripcion?: string;
};

type FormData = {
  nombre: string;
  precio: string;
  stock: string;
  categoriaId: string;
  imagen: File | null;
  descripcion: string;
};

export default function AdminProductos() {
  const [productos, setProductos] = useState<Product[]>([]);
  const [categorias, setCategorias] = useState<{ id: number; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { addNotification } = useAppStore();

  const [formData, setFormData] = useState<FormData>({
    nombre: '',
    precio: '',
    stock: '',
    categoriaId: '',
    imagen: null,
    descripcion: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    try {
      setLoading(true);
      const [prods, cats] = await Promise.all([
        apiFetch<Product[]>('/productos').catch(() => []),
        apiFetch<{ id: number; nombre: string }[]>('/categorias').catch(() => []),
      ]);
      const mappedProds = (Array.isArray(prods) ? prods : []).map((p: any) => {
        const nombre = String(p?.nombre ?? p?.name ?? '').trim();
        const precio = Number(p?.precio ?? p?.price ?? 0);
        const stock = Number(p?.stock ?? 0);
      const img = p?.imagenUrl ?? p?.imageUrl ?? null;
      
      // Obtener URL base eliminando '/api' del final
      const baseUrl = API_URL.replace(/\/api\/?$/, '');
      
      const imagenUrl = typeof img === 'string' && img.startsWith('/') 
        ? `${baseUrl}${img}` 
        : (typeof img === 'string' && !img.startsWith('http') ? `${baseUrl}/${img}` : img);
      const categoryName = p?.categoria?.nombre ?? p?.category ?? '';
      const categoria = categoryName ? { id: 0, nombre: String(categoryName) } : undefined;
      const descripcion = String(p?.descripcion ?? p?.description ?? '');
      return { id: Number(p?.id ?? 0), nombre, precio, stock, imagenUrl, categoria, descripcion } as Product;
    });
      const mappedCats = (Array.isArray(cats) ? cats : []).map((c: any) => ({ id: Number(c?.id ?? 0), nombre: String(c?.nombre ?? c?.name ?? '') }));
      setProductos(mappedProds);
      setCategorias(mappedCats);
    } catch (error) {
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Formato no permitido. Use JPG, PNG o WEBP');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen supera 5MB');
      return;
    }

    setFormData({ ...formData, imagen: file });
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nombre || !formData.precio || !formData.stock || !formData.descripcion || !formData.descripcion.trim()) {
      toast.error('Complete todos los campos requeridos');
      return;
    }

    try {
      const precioNum = Number(formData.precio);
      const stockNum = Number(formData.stock);
      if (!Number.isFinite(precioNum) || precioNum <= 0) {
        toast.error('El precio debe ser mayor a 0');
        return;
      }
      if (!Number.isInteger(stockNum) || stockNum < 0) {
        toast.error('El stock debe ser un entero >= 0');
        return;
      }
      if (formData.descripcion.length > 500) {
        toast.error('La descripción no debe exceder 500 caracteres');
        return;
      }

      const fd = new FormData();
      fd.append('name', formData.nombre);
      fd.append('price', String(precioNum));
      fd.append('stock', String(stockNum));
      fd.append('description', formData.descripcion.trim());
      if (formData.categoriaId) {
        const cat = categorias.find(c => String(c.id) === String(formData.categoriaId));
        const catName = cat ? cat.nombre : '';
        if (catName) fd.append('category', catName);
      }
      if (formData.imagen) fd.append('image', formData.imagen);

      const path = selectedProduct ? `/productos/${selectedProduct.id}` : '/productos';
      const method = selectedProduct ? 'PUT' : 'POST';
      await apiFetch(path, { method, body: fd });

      toast.success(selectedProduct ? 'Producto actualizado' : 'Producto creado');
      addNotification({
        type: 'success',
        title: selectedProduct ? 'Producto actualizado' : 'Producto creado',
        message: `${formData.nombre} ha sido ${selectedProduct ? 'actualizado' : 'creado'} exitosamente`,
      });

      setShowModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      const msg = String(error?.message || error);
      toast.error(msg.includes('401') ? 'No autorizado. Inicie sesión.' : msg);
      console.error(error);
    }
  };

  const handleDelete = async () => {
    if (!selectedProduct) return;

    try {
      await apiFetch(`/productos/${selectedProduct.id}`, { method: 'DELETE' });
      toast.success('Producto eliminado');
      addNotification({
        type: 'success',
        title: 'Producto eliminado',
        message: `${selectedProduct.nombre} ha sido eliminado`,
      });
      setShowDeleteDialog(false);
      setSelectedProduct(null);
      loadData();
    } catch (error) {
      toast.error('Error al eliminar producto');
    }
  };

  const openCreateModal = () => {
    resetForm();
    setSelectedProduct(null);
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      nombre: product.nombre,
      precio: String(Number(product.precio ?? 0)),
      stock: String(Number(product.stock ?? 0)),
      categoriaId: product.categoria?.id?.toString?.() || '',
      imagen: null,
      descripcion: String(product.descripcion ?? ''),
    });
    // Construir URL correcta para el preview (sin /api)
    const previewUrl = product.imagenUrl 
      ? (product.imagenUrl.startsWith('http') 
          ? product.imagenUrl 
          : (() => {
              const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
              const BACKEND_BASE = API_BASE.replace(/\/api\/?$/, '');
              return `${BACKEND_BASE}${product.imagenUrl.startsWith('/') ? product.imagenUrl : '/' + product.imagenUrl}`;
            })())
      : null;
    setImagePreview(previewUrl);
    setShowModal(true);
  };

  const openDeleteDialog = (product: Product) => {
    setSelectedProduct(product);
    setShowDeleteDialog(true);
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      precio: '',
      stock: '',
      categoriaId: '',
      imagen: null,
      descripcion: '',
    });
    setImagePreview(null);
  };

  const columns: ColumnDef<Product, any>[] = [
    {
      accessorKey: 'id',
      header: 'ID',
      cell: ({ getValue }) => `#${getValue()}`,
    },
    {
      accessorKey: 'imagenUrl',
      header: 'Imagen',
      cell: ({ getValue }) => {
        const url = getValue();
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        const BACKEND_BASE = API_BASE.replace(/\/api\/?$/, '');
        const imageUrl = url 
          ? (url.startsWith('http') ? url : `${BACKEND_BASE}${url.startsWith('/') ? url : '/' + url}`)
          : null;
        return imageUrl ? (
          <img src={imageUrl} alt="Producto" className="h-12 w-12 object-cover rounded-xl" />
        ) : (
          <div className="h-12 w-12 bg-[var(--surface-2)] rounded-xl flex items-center justify-center">
            <PhotoIcon className="h-6 w-6 text-[var(--text-muted)]" />
          </div>
        );
      },
    },
    {
      accessorKey: 'nombre',
      header: 'Nombre',
      cell: ({ getValue }) => (
        <span className="font-medium">{getValue()}</span>
      ),
    },
    {
      accessorKey: 'categoria',
      header: 'Categoría',
      cell: ({ getValue }) => {
        const cat = getValue();
        return cat ? (
          <span className="sp-badge sp-badge--primary">
            {cat.nombre}
          </span>
        ) : (
          <span className="sp-muted">Sin categoría</span>
        );
      },
    },
    {
      accessorKey: 'precio',
      header: 'Precio',
      cell: ({ getValue }) => {
        const raw = getValue();
        const value = typeof raw === 'number' ? raw : Number(raw ?? 0);
        return `S/ ${Number.isFinite(value) ? value.toFixed(2) : '0.00'}`;
      },
    },
    {
      accessorKey: 'stock',
      header: 'Stock',
      cell: ({ getValue }) => {
        const stock = getValue();
        return (
          <span className={`sp-badge ${
            stock === 0
              ? 'sp-badge--accent'
              : stock < 10
                ? 'sp-badge--primary'
                : 'sp-badge--secondary'
          }`}>
            {stock}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            onClick={() => openEditModal(row.original)}
            className="sp-button sp-button-ghost h-9 w-9 !p-0 text-blue-600"
            title="Editar"
          >
            <PencilIcon className="h-5 w-5" />
          </button>
          <button
            onClick={() => openDeleteDialog(row.original)}
            className="sp-button sp-button-ghost h-9 w-9 !p-0 text-rose-600"
            title="Eliminar"
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <Protected>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="sp-card sp-card-static px-10 py-8 text-center">
            <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-[var(--brand-primary)] mx-auto mb-4"></div>
            <p className="sp-muted">Cargando productos...</p>
          </div>
        </div>
      </Protected>
    );
  }

  return (
    <Protected>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Productos</h1>
            <p className="sp-muted mt-1">Gestiona el inventario de productos</p>
          </div>
          <button
            onClick={openCreateModal}
            className="sp-button sp-button-primary"
          >
            <PlusIcon className="h-5 w-5" />
            Nuevo Producto
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="sp-widget sp-widget-primary">
            <p className="text-sm sp-muted">Total Productos</p>
            <p className="text-2xl font-bold mt-2">{productos.length}</p>
          </div>
          <div className="sp-widget sp-widget-secondary">
            <p className="text-sm sp-muted">En Stock</p>
            <p className="text-2xl font-bold mt-2">
              {productos.filter(p => p.stock > 0).length}
            </p>
          </div>
          <div className="sp-widget sp-widget-accent">
            <p className="text-sm sp-muted">Bajo Stock</p>
            <p className="text-2xl font-bold mt-2">
              {productos.filter(p => p.stock > 0 && p.stock < 10).length}
            </p>
          </div>
          <div className="sp-widget sp-widget-primary">
            <p className="text-sm sp-muted">Sin Stock</p>
            <p className="text-2xl font-bold mt-2">
              {productos.filter(p => p.stock === 0).length}
            </p>
          </div>
        </div>

        <AdvancedTable
          data={productos}
          columns={columns}
          title="Listado de Productos"
          searchPlaceholder="Buscar producto..."
          enableExport={true}
          pageSize={10}
        />

        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={selectedProduct ? 'Editar Producto' : 'Nuevo Producto'}
          size="lg"
        >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="sp-form-label">Nombre del Producto *</label>
            <input
              type="text"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="sp-input"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="sp-form-label">Precio (S/) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.precio}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === '' || Number(next) >= 0) {
                    setFormData({ ...formData, precio: next });
                  }
                }}
                className="sp-input"
                required
              />
            </div>
            <div>
              <label className="sp-form-label">Stock *</label>
              <input
                type="number"
                min="0"
                value={formData.stock}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === '' || Number(next) >= 0) {
                    setFormData({ ...formData, stock: next });
                  }
                }}
                className="sp-input"
                required
              />
            </div>
          </div>

          <div>
            <label className="sp-form-label">Descripción detallada * (máx 500)</label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value.slice(0, 500) })}
              className="sp-textarea"
              rows={4}
              maxLength={500}
              required
              placeholder="Puedes usar saltos de línea y listas con - o *"
            />
            <div className="text-xs sp-muted mt-1">{formData.descripcion.length}/500</div>
          </div>

          <div>
            <label className="sp-form-label">Categoría</label>
            <select
              value={formData.categoriaId}
              onChange={(e) => setFormData({ ...formData, categoriaId: e.target.value })}
              className="sp-select"
            >
              <option value="">Sin categoría</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nombre}
                </option>
              ))}
            </select>
          </div>

            <div>
              <label className="sp-form-label">Imagen del Producto</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                className="sp-file"
              />
              <p className="text-xs sp-muted mt-1">
                Formatos permitidos: JPG, PNG, WEBP. Máximo 5MB.
              </p>
              {imagePreview && (
                <div className="mt-4">
                  <img src={imagePreview} alt="Preview" className="h-40 w-auto rounded border" />
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="sp-button sp-button-outline"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="sp-button sp-button-primary"
              >
                {selectedProduct ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </form>
        </Modal>

        <ConfirmDialog
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDelete}
          title="Eliminar Producto"
          message={`¿Está seguro de eliminar el producto "${selectedProduct?.nombre}"? Esta acción no se puede deshacer.`}
          type="danger"
          confirmText="Eliminar"
          cancelText="Cancelar"
        />
      </div>
    </Protected>
  );
}
