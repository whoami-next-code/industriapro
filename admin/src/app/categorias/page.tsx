"use client";
import React, { useState } from "react";
import { API_URL, apiFetch } from "@/lib/api";
import Protected from "@/lib/Protected";

export default function CategoriasPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ name?: string; image?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);
  type Categoria = { id: number; name: string; description?: string; imageUrl?: string };
  const [list, setList] = useState<Categoria[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editImage, setEditImage] = useState<File | null>(null);

  React.useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    (async () => {
      try {
        const data = await apiFetch<Categoria[]>(`/categorias`);
        setList(Array.isArray(data) ? data : []);
      } catch {
      }
    })();
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImage(file);
    setErrors((prev) => ({ ...prev, image: undefined }));
    if (file) {
      const img = new Image();
      img.onload = () => {
        if (img.width < 400 || img.height < 300) {
          setErrors((prev) => ({ ...prev, image: "Dimensiones mínimas 400x300px." }));
        }
      };
      img.src = URL.createObjectURL(file);
    }
  };

  const startEdit = (c: Categoria) => {
    setEditingId(c.id);
    setEditName(c.name || "");
    setEditDescription(c.description || "");
    setEditImage(null);
  };

  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setEditImage(file);
    setErrors((prev) => ({ ...prev, image: undefined }));
    if (file) {
      const img = new Image();
      img.onload = () => {
        if (img.width < 400 || img.height < 300) {
          setErrors((prev) => ({ ...prev, image: "Dimensiones mínimas 400x300px." }));
        }
      };
      img.src = URL.createObjectURL(file);
    }
  };

  const submitEdit = async (id: number) => {
    const newErrors: typeof errors = {};
    if (!editName.trim()) newErrors.name = "El nombre es obligatorio";
    if (editImage && errors.image) newErrors.image = errors.image;
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("name", editName.trim());
      fd.append("description", editDescription);
      if (editImage) fd.append("image", editImage);
      const res = await fetch(`${API_URL}/categorias/${id}`, { method: "PUT", body: fd, credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setList((prev) => prev.map((x) => (x.id === id ? updated : x)));
      setEditingId(null);
      setEditName("");
      setEditDescription("");
      setEditImage(null);
      setErrors({});
    } catch (err: unknown) {
      setErrors({ general: err instanceof Error ? err.message : 'Error' });
    } finally {
      setLoading(false);
    }
  };

  const removeCat = async (id: number) => {
    if (!confirm("¿Eliminar esta categoría?")) return;
    try {
      await apiFetch(`/categorias/${id}`, { method: "DELETE" });
      setList((prev) => prev.filter((x) => x.id !== id));
    } catch (err: unknown) {
      setErrors({ general: err instanceof Error ? err.message : 'Error' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};
    if (!name.trim()) newErrors.name = "El nombre es obligatorio";
    if (image && errors.image) newErrors.image = errors.image;
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      if (description) fd.append("description", description);
      if (image) fd.append("image", image);
      const res = await fetch(`${API_URL}/categorias`, { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Error al crear la categoría");
      }
      const created = await res.json();
      setList((prev) => [created, ...prev]);
      setName("");
      setDescription("");
      setImage(null);
      setErrors({});
    } catch (err: unknown) {
      setErrors({ general: err instanceof Error ? err.message : 'Error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Protected>
      <div className="p-4 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Crear categoría</h1>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 sp-panel">
        <div className="md:col-span-2">
          <label className="sp-form-label">Nombre *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="sp-input"
            placeholder="Ej. Accesorios"
            required
            aria-required="true"
          />
          {errors.name && <p className="text-red-600 text-sm mt-1" role="alert">{errors.name}</p>}
        </div>

        <div className="md:col-span-2">
          <label className="sp-form-label">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="sp-textarea"
            rows={3}
            placeholder="Descripción breve"
          />
        </div>

        <div>
          <label className="sp-form-label">Imagen (JPG, PNG, WEBP) máx 5MB</label>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="sp-file" />
          {errors.image && <p className="text-red-600 text-sm" role="alert">{errors.image}</p>}
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="sp-button sp-button-primary"
          >
            {loading ? "Creando..." : "Crear"}
          </button>
        </div>
        {errors.general && <p className="md:col-span-2 text-red-600 text-sm" role="alert">{errors.general}</p>}
      </form>

      <h2 className="text-xl font-semibold mt-8 mb-2">Categorías</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {list.map((c) => (
          <div key={c.id} className="sp-card sp-card-static p-3 flex flex-col items-center text-center">
            <div className="w-24 h-24 bg-[var(--surface-2)] rounded-xl overflow-hidden mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.imageUrl ? (c.imageUrl.startsWith('http') ? c.imageUrl : (() => {
                  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
                  const BACKEND_BASE = API_BASE.replace(/\/api\/?$/, '');
                  return `${BACKEND_BASE}${c.imageUrl.startsWith('/') ? c.imageUrl : '/' + c.imageUrl}`;
                })()) : '/window.svg'}
                alt={c.name}
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.src = '/window.svg'; }}
              />
            </div>
            <div className="font-medium">{c.name}</div>
            {c.description && <div className="text-sm sp-muted">{c.description}</div>}
            <div className="mt-2 flex gap-2">
              <button className="sp-button sp-button-outline text-xs" onClick={() => startEdit(c)}>Editar</button>
              <button className="sp-button sp-button-outline text-xs text-rose-600" onClick={() => removeCat(c.id)}>Eliminar</button>
            </div>

            {editingId === c.id && (
              <div className="mt-3 w-full text-left">
                <div className="mb-2">
                  <label className="sp-form-label text-xs">Nombre</label>
                  <input className="sp-input text-sm" value={editName} onChange={(e)=>setEditName(e.target.value)} />
                </div>
                <div className="mb-2">
                  <label className="sp-form-label text-xs">Descripción</label>
                  <textarea className="sp-textarea text-sm" rows={2} value={editDescription} onChange={(e)=>setEditDescription(e.target.value)} />
                </div>
                <div className="mb-2">
                  <label className="sp-form-label text-xs">Imagen (opcional)</label>
                  <input type="file" accept="image/*" onChange={handleEditImageChange} className="sp-file text-xs" />
                  {errors.image && <p className="text-red-600 text-xs">{errors.image}</p>}
                </div>
                <div className="flex gap-2">
                  <button className="sp-button sp-button-primary text-xs" disabled={loading} onClick={()=>submitEdit(c.id)}>{loading? 'Guardando...':'Guardar'}</button>
                  <button className="sp-button sp-button-outline text-xs" onClick={()=>{ setEditingId(null); setErrors({}); }}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      </div>
    </Protected>
  );
}
