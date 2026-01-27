"use client";
import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Punto = { t: string; v: number };

export default function ReportesPage() {
  const [puntos, setPuntos] = useState<Punto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState<string | null>(null);

  const cargar = async () => {
    setError(null);
    try {
      const data = await apiFetch<{ puntos?: Punto[] }>("/reportes/muestreo");
      setPuntos(data.puntos || []);
    } catch (err: any) {
      setError(err.message || "Error cargando datos de muestreo");
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  // Gráfico simple sin librerías: barras horizontales con CSS
  const max = Math.max(1, ...puntos.map((p) => p.v));

  const descargarJSON = () => {
    const blob = new Blob([JSON.stringify({ puntos }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reporte-muestreo.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const guardar = async () => {
    setGuardando(true);
    setExito(null);
    try {
      await apiFetch("/reportes/guardar", {
        method: "POST",
        body: JSON.stringify({ nombre: "Reporte de muestreo", datos: { puntos } }),
      });
      setExito("Reporte guardado correctamente");
    } catch (err: any) {
      setError(err.message || "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Visualización de muestreo</h1>
      {error && <div className="mb-3 p-2 bg-red-100 text-red-700 rounded">{error}</div>}
      {exito && <div className="mb-3 p-2 bg-green-100 text-green-700 rounded">{exito}</div>}
      <div className="border rounded p-4">
        {puntos.length === 0 ? (
          <div className="text-sm text-gray-600">Sin datos</div>
        ) : (
          <div className="space-y-2">
            {puntos.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="text-xs w-32 text-gray-600">{new Date(p.t).toLocaleTimeString()}</div>
                <div className="h-4 bg-blue-500" style={{ width: `${(p.v / max) * 100}%` }} />
                <div className="text-xs w-10">{p.v}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-4 flex gap-3">
        <button className="px-4 py-2 bg-gray-700 text-white rounded" onClick={descargarJSON}>Descargar JSON</button>
        <button className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50" disabled={guardando} onClick={guardar}>{guardando ? "Guardando..." : "Guardar"}</button>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded" onClick={cargar}>Actualizar</button>
      </div>
    </div>
  );
}

