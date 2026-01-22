"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { apiFetchAuth, requireAuthOrRedirect, getToken, API_URL, getImageUrl } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { z } from "zod";

type Product = {
  id: number;
  name: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  price?: number;
};

type QuoteItem = { productId: number; quantity: number; productName?: string };

type ProgressUpdate = {
  message: string;
  status?: string;
  estimatedDate?: string;
  attachmentUrls?: string[];
  createdAt: string;
  author?: string;
  channel?: string;
};

type QuoteDetail = {
  id: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerCompany?: string;
  productName?: string;
  productImage?: string;
  need?: string;
  notes?: string;
  estimatedDate?: string;
  budget?: string;
  preferredChannel?: string;
  technicianName?: string;
  technicianPhone?: string;
  technicianEmail?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  items: QuoteItem[];
  attachmentUrls?: string[];
  progressUpdates?: ProgressUpdate[];
};

type ClienteProfile = {
  fullName?: string | null;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

const STATUS_OPTIONS = ["NUEVA", "EN_PROCESO", "ENVIADA", "ENTREGADA", "COMPLETADA", "CANCELADA"];

export default function Cotizacion() {
  const params = useSearchParams();
  const { loading: authLoading, user } = useAuth();
  const productIdParam = params?.get("productId");
  const productNameParam = params?.get("name");
  const productImageParam = params?.get("image");
  const preselectedId = productIdParam ? Number(productIdParam) : null;
  const cotizacionIdParam = params?.get("id");

  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(cotizacionIdParam ? Number(cotizacionIdParam) || null : null);
  const [lastEmail, setLastEmail] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [product, setProduct] = useState<Product | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressForm, setProgressForm] = useState({
    message: "",
    status: "EN_PROCESO",
    estimatedDate: "",
    technicianName: "",
    technicianPhone: "",
    technicianEmail: "",
  });
  const [clientData, setClientData] = useState<{ fullName: string; document: string; email: string; phone: string; address: string }>({
    fullName: "",
    document: "",
    email: "",
    phone: "",
    address: "",
  });
  const [clientLoading, setClientLoading] = useState(true);
  const [clientError, setClientError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    document: "",
    address: "",
    need: "",
    delivery: "",
    budget: "",
    message: "",
  });
  const profileIncomplete = useMemo(() => {
    return (
      !clientData.document?.trim() ||
      !clientData.phone?.trim() ||
      !clientData.address?.trim() ||
      !clientData.fullName?.trim()
    );
  }, [clientData]);

  const subtitle = useMemo(() => {
    if (preselectedId) {
      return `Estás cotizando: ${productNameParam ?? `Producto #${preselectedId}`}`;
    }
    return "Completa el formulario para solicitar una cotización.";
  }, [preselectedId, productNameParam]);

  useEffect(() => {
    if (authLoading) return;

    const token = getToken();
    if (!token && !user) {
      requireAuthOrRedirect();
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading) return;
    async function loadClient() {
      setClientLoading(true);
      setClientError(null);
      try {
        const data = await apiFetchAuth<ClienteProfile>("/clientes/me");
        const next = {
          fullName: data?.fullName ?? "",
          document: data?.document ?? "",
          email: data?.email ?? "",
          phone: data?.phone ?? "",
          address: data?.address ?? "",
        };
        setClientData(next);
        setFormState((prev) => ({
          ...prev,
          name: next.fullName || prev.name,
          email: next.email || prev.email,
          phone: next.phone || prev.phone,
          document: next.document || prev.document,
          address: next.address || prev.address,
        }));
      } catch (err: any) {
        setClientError(err?.message || "No se pudo obtener los datos del cliente");
      } finally {
        setClientLoading(false);
      }
    }
    loadClient();
  }, [authLoading]);

  useEffect(() => {
    async function loadProduct() {
      if (!preselectedId) return;
      try {
        const res = await fetch(`${API_URL}/productos/${preselectedId}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const json = await res.json();
          setProduct(json);
        }
      } catch (e: any) {
        // ignorar
      }
    }
    loadProduct();
  }, [preselectedId]);

  useEffect(() => {
    if (!createdId) return;
    loadQuote(createdId);
  }, [createdId]);

  const basePrice = useMemo(() => {
    const price = Number(product?.price) || 0;
    return price * (Number(qty) || 1);
  }, [product?.price, qty]);

  const todayIso = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().split("T")[0];
  }, []);

  const deliveryWarning = useMemo(() => {
    if (!formState.delivery) return null;
    const parsed = new Date(formState.delivery);
    if (Number.isNaN(parsed.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date(today);
    limit.setDate(limit.getDate() + 7);
    parsed.setHours(0, 0, 0, 0);
    if (parsed < limit) {
      return "Es probable que la entrega demore un poco mas.";
    }
    return null;
  }, [formState.delivery]);

  const quoteSchema = useMemo(
    () =>
      z
        .object({
          name: z.string().min(1, "Nombre requerido"),
          email: z.string().email("Correo inválido"),
          phone: z.string().optional().refine((val) => !val || /^(?:\+51|51)?\s?9\d{2}[\s-]?\d{3}[\s-]?\d{3}$/.test(val), "Teléfono inválido (ej: +51 916 695 927)"),
          company: z.string().optional(),
          document: z.string().optional(),
          address: z.string().optional(),
          need: z.string().min(10, "Describe tu necesidad con más detalle"),
          delivery: z
            .string()
            .optional()
            .refine(
              (v) => {
                if (!v) return true;
                const parsed = new Date(v);
                if (Number.isNaN(parsed.getTime())) return false;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                parsed.setHours(0, 0, 0, 0);
                return parsed >= today;
              },
              { message: "La fecha no puede ser pasada" },
            ),
          budget: z
            .string()
            .optional()
            .transform((v) => (v ? Number(v) : undefined))
            .refine(
              (v) => v === undefined || Number.isFinite(v),
              "Presupuesto debe ser numérico",
            ),
          message: z.string().optional(),
        })
        .superRefine((data, ctx) => {
          if (basePrice > 0 && data.budget !== undefined) {
            if (data.budget < basePrice) {
              ctx.addIssue({
                code: "custom",
                message: "El presupuesto no puede ser menor al precio del producto seleccionado",
                path: ["budget"],
              });
            }
          }
        }),
    [basePrice],
  );

  function validateState(state: typeof formState) {
    const parsed = quoteSchema.safeParse(state);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        const key = i.path?.[0];
        if (typeof key === "string" && !fieldErrors[key]) {
          fieldErrors[key] = i.message;
        }
      });
      setErrors(fieldErrors);
      return { ok: false, data: null };
    }
    setErrors({});
    return { ok: true, data: parsed.data };
  }

  function handleFieldChange<K extends keyof typeof formState>(key: K, value: (typeof formState)[K]) {
    setFormState((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "delivery" || key === "budget" || key === "need") {
        validateState(next);
      }
      return next;
    });
  }

  async function loadQuote(id: number) {
    const token = getToken();
    if (!token) return;
    try {
      const data = await apiFetchAuth(`/cotizaciones/${id}`, { method: "GET" });
      setQuote(data);
    } catch (err: any) {
      setOk("No se pudo cargar la cotización.");
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setOk(null);
    const token = getToken(); // Usar getToken directamente para evitar redirecciones infinitas si falla
    if (!token) {
      requireAuthOrRedirect();
      setLoading(false);
      return;
    }
    if (profileIncomplete) {
      setOk("Completa tu perfil para continuar");
      router.push("/perfil");
      setLoading(false);
      return;
    }
    const validation = validateState(formState);
    if (!validation.ok || !validation.data) {
      setLoading(false);
      return;
    }
    const parsed = validation.data;
    const items = preselectedId
      ? [{ productId: preselectedId, quantity: qty, productName: productNameParam || product?.name }]
      : [{ productId: 1, quantity: 1 }];

    try {
      const payload = {
        customerName: parsed.name,
        customerEmail: parsed.email,
        customerPhone: parsed.phone,
        company: parsed.company,
        customerDocument: formState.document,
        customerAddress: formState.address,
        need: parsed.need,
        delivery: parsed.delivery || undefined,
        budget: parsed.budget,
        items,
        notes: parsed.message,
        productName: productNameParam || product?.name,
        productImage: productImageParam || (product?.imageUrl ? `${API_URL}${product.imageUrl}` : product?.thumbnailUrl ? `${API_URL}${product.thumbnailUrl}` : undefined),
      };
      const data = await apiFetchAuth("/cotizaciones", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setOk("Solicitud enviada correctamente.");
      setCreatedId(data?.id ?? null);
      setLastEmail(payload.customerEmail || "");
      setFormState((prev) => ({
        ...prev,
        need: "",
        delivery: "",
        budget: "",
        message: "",
      }));
      if (data?.id) {
        await loadQuote(data.id);
      }
    } catch (err: any) {
      setOk("No se pudo enviar la solicitud: " + (err?.message || "Error desconocido"));
    } finally {
      setLoading(false);
    }
  }

  async function submitProgress(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!quote?.id) return;
    setProgressLoading(true);
    setOk(null);
    const token = getToken();
    if (!token) {
      requireAuthOrRedirect();
      setProgressLoading(false);
      return;
    }
    try {
      await apiFetchAuth(`/cotizaciones/${quote.id}/avances`, {
        method: "POST",
        body: JSON.stringify({
          message: progressForm.message,
          status: progressForm.status,
          estimatedDate: progressForm.estimatedDate,
          technicianName: progressForm.technicianName || quote?.technicianName,
          technicianPhone: progressForm.technicianPhone || quote?.technicianPhone,
          technicianEmail: progressForm.technicianEmail || quote?.technicianEmail,
        }),
      });
      setProgressForm((prev) => ({ ...prev, message: "" }));
      await loadQuote(quote.id);
      setOk("Avance enviado al cliente.");
    } catch (err: any) {
      setOk("No se pudo enviar el avance: " + (err?.message || "Error desconocido"));
    } finally {
      setProgressLoading(false);
    }
  }

  const imageSrc = getImageUrl(product?.imageUrl || product?.thumbnailUrl || productImageParam);

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Cotización y seguimiento</h1>
        <p className="text-sm text-zinc-600">
          {subtitle} Aquí podrás ver todo el detalle de la solicitud, enviar avances al cliente y asignar un técnico.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {quote ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase text-zinc-500">Estado</p>
                    <p className="text-lg font-semibold">{quote.status}</p>
                    <p className="text-xs text-zinc-500">ID #{quote.id}</p>
                  </div>
                  <div className="text-right text-sm text-zinc-600">
                    <p>Creada: {new Date(quote.createdAt).toLocaleString()}</p>
                    {quote.estimatedDate && <p>Entrega estimada: {quote.estimatedDate}</p>}
                    {quote.budget && <p>Presupuesto: {quote.budget}</p>}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
                <h3 className="text-sm font-semibold">Datos del cliente</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-zinc-700">
                  <p><span className="text-zinc-500">Nombre:</span> {quote.customerName}</p>
                  <p><span className="text-zinc-500">Email:</span> {quote.customerEmail}</p>
                  {quote.customerPhone && <p><span className="text-zinc-500">Teléfono:</span> {quote.customerPhone}</p>}
                  {quote.customerCompany && <p><span className="text-zinc-500">Empresa:</span> {quote.customerCompany}</p>}
                  {quote.preferredChannel && <p><span className="text-zinc-500">Canal:</span> {quote.preferredChannel}</p>}
                </div>
              </div>

              <div className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={quote.productImage || imageSrc} alt={quote.productName || "Producto"} className="h-20 w-20 rounded object-cover border" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold">Producto / servicio</h3>
                    <p className="text-sm text-zinc-700">{quote.productName ?? productNameParam ?? product?.name ?? "No especificado"}</p>
                    <ul className="mt-2 list-disc pl-5 text-xs text-zinc-600">
                      {(quote.items ?? []).map((it, idx) => (
                        <li key={idx}>Producto #{it.productId} — Cantidad: {it.quantity}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                {quote.need && (
                  <div className="text-sm text-zinc-700">
                    <p className="text-xs font-semibold text-zinc-500 mb-1">Necesidad</p>
                    <p className="whitespace-pre-wrap">{quote.need}</p>
                  </div>
                )}
                {quote.notes && (
                  <div className="text-sm text-zinc-700">
                    <p className="text-xs font-semibold text-zinc-500 mb-1">Notas adicionales</p>
                    <p className="whitespace-pre-wrap">{quote.notes}</p>
                  </div>
                )}
              </div>

              <div className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
                <h3 className="text-sm font-semibold">Estado técnico</h3>
                <p className="text-xs text-zinc-500">Seguimiento técnico y asignación</p>
              </div>

              <div className="rounded-lg border bg-white p-4 shadow-sm space-y-2">
                <h3 className="text-sm font-semibold">Técnico asignado</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-zinc-700">
                  <p><span className="text-zinc-500">Nombre:</span> {quote.technicianName ?? "Pendiente"}</p>
                  <p><span className="text-zinc-500">Teléfono:</span> {quote.technicianPhone ?? "Pendiente"}</p>
                  <p><span className="text-zinc-500">Email:</span> {quote.technicianEmail ?? "Pendiente"}</p>
                </div>
              </div>

              <div className="rounded-lg border bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Avances y reportes</h3>
                  <span className="text-xs text-zinc-500">{quote.progressUpdates?.length ?? 0} eventos</span>
                </div>
                <div className="space-y-3">
                  {quote.progressUpdates?.length ? (
                    quote.progressUpdates.map((p, idx) => (
                      <div key={idx} className="rounded border p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-zinc-800">{p.status ?? "Actualización"}</div>
                          <div className="text-xs text-zinc-500">{new Date(p.createdAt).toLocaleString()}</div>
                        </div>
                        <p className="mt-1 text-zinc-700 whitespace-pre-wrap">{p.message}</p>
                        <div className="text-xs text-zinc-500 mt-1">
                          {p.estimatedDate && <span className="mr-2">Entrega estimada: {p.estimatedDate}</span>}
                          {p.author && <span>Autor: {p.author}</span>}
                        </div>
                        {p.attachmentUrls?.length ? (
                          <ul className="mt-1 text-xs text-blue-700 underline space-y-1">
                            {p.attachmentUrls.map((url, i) => (
                              <li key={i}><a href={url} target="_blank" rel="noreferrer">Adjunto {i + 1}</a></li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500">Sin avances registrados.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-white p-4 shadow-sm text-sm text-zinc-600">
              Crea la cotización para ver el detalle, adjuntos, técnico y avances.
            </div>
          )}
        </div>

        <div className="space-y-4">
          <form onSubmit={submit} className="space-y-4 bg-white shadow-sm rounded-lg p-4 border">
            <div>
              <h3 className="text-sm font-semibold mb-1">Nueva cotización</h3>
              <p className="text-xs text-zinc-500">Datos del cliente y requerimiento</p>
            </div>
            {clientError && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
                {clientError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <input
                  name="name"
                  value={formState.name}
                  readOnly
                  aria-readonly
                  placeholder={clientLoading ? "Cargando nombre..." : "Nombre completo"}
                  className="w-full border rounded px-3 py-2 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
                <p className="text-[11px] text-gray-500 mt-1">Autocompletado desde tu perfil</p>
                {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
              </div>
              <div>
                <input
                  name="email"
                  type="email"
                  value={formState.email}
                  readOnly
                  aria-readonly
                  placeholder={clientLoading ? "Cargando correo..." : "Correo"}
                  className="w-full border rounded px-3 py-2 bg-gray-50 text-gray-600 cursor-not-allowed"
                />
                {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
              </div>
              <input
                name="phone"
                value={formState.phone}
                readOnly
                aria-readonly
                placeholder={clientLoading ? "Cargando teléfono..." : "Teléfono"}
                className="w-full border rounded px-3 py-2 bg-gray-50 text-gray-600 cursor-not-allowed"
              />
              <input
                name="document"
                value={formState.document}
                readOnly
                aria-readonly
                placeholder={clientLoading ? "Cargando DNI / RUC..." : "DNI / RUC"}
                className="w-full border rounded px-3 py-2 bg-gray-50 text-gray-600 cursor-not-allowed"
              />
              <input
                name="address"
                value={formState.address}
                readOnly
                aria-readonly
                placeholder={clientLoading ? "Cargando dirección..." : "Dirección"}
                className="w-full border rounded px-3 py-2 bg-gray-50 text-gray-600 cursor-not-allowed sm:col-span-2"
              />
              <input
                name="company"
                value={formState.company}
                onChange={(e) => handleFieldChange("company", e.target.value)}
                placeholder="Empresa (opcional)"
                className="w-full border rounded px-3 py-2 sm:col-span-2"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Necesidad / Caso de uso *</label>
              <textarea
                name="need"
                placeholder="Describe el problema o necesidad (capacidad, volumen, entorno de uso, etc.)"
                className="w-full border rounded px-3 py-2"
                rows={4}
                value={formState.need}
                onChange={(e) => handleFieldChange("need", e.target.value)}
              />
              {errors.need && <p className="text-xs text-red-600">{errors.need}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                name="delivery"
                type="date"
                min={todayIso}
                value={formState.delivery}
                onChange={(e) => handleFieldChange("delivery", e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
              <input
                name="budget"
                type="number"
                min={basePrice || 0}
                step="0.01"
                value={formState.budget}
                onChange={(e) => handleFieldChange("budget", e.target.value)}
                placeholder="Presupuesto estimado"
                className="w-full border rounded px-3 py-2"
              />
              <input
                name="message"
                value={formState.message}
                onChange={(e) => handleFieldChange("message", e.target.value)}
                placeholder="Notas adicionales"
                className="w-full border rounded px-3 py-2"
              />
            </div>
            {errors.delivery && <p className="text-xs text-red-600">{errors.delivery}</p>}
            {deliveryWarning && !errors.delivery && (
              <p className="text-xs text-amber-600">{deliveryWarning}</p>
            )}
            {errors.budget && <p className="text-xs text-red-600">{errors.budget}</p>}
            {basePrice > 0 && (
              <p className="text-xs text-zinc-500">
                Precio base del producto: S/ {basePrice.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
              </p>
            )}

            {product && (
              <div className="flex gap-3 items-center border rounded-lg p-3 bg-zinc-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageSrc} alt={product.name} className="h-14 w-14 object-cover rounded" />
                <div className="flex-1">
                  <div className="font-semibold text-sm">{product.name}</div>
                  {product.price && (
                    <div className="text-sm text-emerald-700">S/ {product.price}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-600">Cantidad</label>
                  <input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value) || 1)}
                    className="w-20 border rounded px-2 py-1 text-sm"
                  />
                </div>
              </div>
            )}

            {profileIncomplete && (
              <div className="p-3 rounded-md border border-amber-200 bg-amber-50 text-sm text-amber-800">
                Completa tu perfil (DNI/RUC, teléfono y dirección) para enviar la cotización.{" "}
                <button
                  type="button"
                  className="underline font-semibold"
                  onClick={() => router.push("/perfil")}
                >
                  Ir a mi perfil
                </button>
              </div>
            )}

            <button
              disabled={loading || profileIncomplete}
              className="w-full inline-flex items-center justify-center rounded-md bg-black text-white px-4 py-2 text-sm disabled:opacity-50"
            >
              {loading ? "Enviando..." : "Enviar cotización"}
            </button>

            {ok && (
              <div className="text-sm text-zinc-700 space-y-1">
                <p>{ok}</p>
                {createdId && (
                  <p>
                    Ver estado:{" "}
                    <a className="underline" href={`/cotizacion/${createdId}`}>
                      #{createdId}
                    </a>
                  </p>
                )}
                {lastEmail && (
                  <p>
                    <a
                      className="underline"
                      href={`/mis-cotizaciones?email=${encodeURIComponent(lastEmail)}`}
                    >
                      Ver todas mis cotizaciones
                    </a>
                  </p>
                )}
              </div>
            )}
          </form>

        </div>
      </div>
    </section>
  );
}

