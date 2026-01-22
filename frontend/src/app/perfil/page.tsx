"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiFetchAuth, requireAuthOrRedirect } from "@/lib/api";

const profileSchema = z.object({
  fullName: z.string().min(1, "Nombre requerido"),
  email: z.string().email("Correo inválido"),
  document: z.string().min(8, "DNI o RUC requerido"),
  phone: z.string().min(6, "Teléfono requerido"),
  address: z.string().min(5, "Dirección requerida"),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function PerfilPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: "", email: "", document: "", phone: "", address: "" },
  });

  useEffect(() => {
    const token = requireAuthOrRedirect("/perfil");
    if (!token) return;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetchAuth<ProfileForm>("/clientes/me");
        reset({
          fullName: data.fullName ?? "",
          email: data.email ?? "",
          document: data.document ?? "",
          phone: data.phone ?? "",
          address: data.address ?? "",
        });
      } catch (e: any) {
        setError(e?.message || "No se pudieron cargar tus datos");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [reset]);

  const onSubmit = async (values: ProfileForm) => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await apiFetchAuth("/clientes/me", {
        method: "PUT",
        body: JSON.stringify(values),
      });
      setMessage("Perfil actualizado correctamente");
      reset(values);
    } catch (e: any) {
      setError(e?.message || "No se pudieron guardar los cambios");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col gap-2 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Mi perfil</h1>
          <p className="text-sm text-gray-600">
            Completa tu información para agilizar compras, entregas y cotizaciones.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="rounded-xl border bg-white p-6 shadow-sm h-40 animate-pulse" />
            <div className="rounded-xl border bg-white p-6 shadow-sm lg:col-span-2 h-64 animate-pulse" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <aside className="rounded-xl border bg-white p-6 shadow-sm space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Cuenta</p>
                <p className="text-lg font-semibold text-gray-900">Información básica</p>
              </div>
              <div className="space-y-2 text-sm text-gray-600">
                <div>
                  <p className="text-gray-500">Nombre</p>
                  <p className="font-medium text-gray-900">{watch("fullName") || "—"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Correo</p>
                  <p className="font-medium text-gray-900">{watch("email") || "—"}</p>
                </div>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-900">
                Tus datos personales están protegidos y sólo se usan para gestionar tus pedidos.
              </div>
              <button
                type="button"
                onClick={() => router.push("/mis-pedidos")}
                className="w-full px-4 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Ver mis pedidos
              </button>
            </aside>

            <form
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-6 rounded-xl border bg-white p-6 shadow-sm lg:col-span-2"
            >
              {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>}
              {message && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-3">{message}</div>}

              <div className="space-y-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Datos personales</h2>
                  <p className="text-xs text-gray-500">Estos datos provienen de tu registro.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Nombre completo</label>
                    <input
                      {...register("fullName")}
                      readOnly
                      aria-readonly
                      className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-700"
                    />
                    {errors.fullName && <p className="text-xs text-red-600">{errors.fullName.message}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Correo</label>
                    <input
                      {...register("email")}
                      type="email"
                      readOnly
                      aria-readonly
                      className="w-full border rounded-lg px-3 py-2 bg-gray-50 text-gray-700"
                    />
                    {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Contacto y facturación</h2>
                  <p className="text-xs text-gray-500">Campos obligatorios marcados con *.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1">
                    <label className="text-sm font-medium text-gray-700">DNI / RUC *</label>
                    <input
                      {...register("document")}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="DNI o RUC"
                    />
                    {errors.document && <p className="text-xs text-red-600">{errors.document.message}</p>}
                  </div>
                  <div className="sm:col-span-1">
                    <label className="text-sm font-medium text-gray-700">Teléfono *</label>
                    <input
                      {...register("phone")}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="+51 9XX XXX XXX"
                    />
                    {errors.phone && <p className="text-xs text-red-600">{errors.phone.message}</p>}
                  </div>
                  <div className="sm:col-span-1">
                    <label className="text-sm font-medium text-gray-700">Dirección *</label>
                    <input
                      {...register("address")}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="Dirección completa"
                    />
                    {errors.address && <p className="text-xs text-red-600">{errors.address.message}</p>}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                <p className="text-xs text-gray-500">
                  Al guardar, actualizaremos tus datos para futuras compras.
                </p>
                <button
                  type="submit"
                  disabled={saving || loading}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Guardando..." : isDirty ? "Guardar cambios" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
