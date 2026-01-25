"use client";
import { useEffect, useState } from "react";
import Protected from "@/lib/Protected";
import { apiFetch } from "@/lib/api";
import Card from "@/components/ui/Card";
import Table, { Th, Td } from "@/components/ui/Table";

type AuditLog = {
  id: number;
  action: string;
  userId?: number;
  meta?: Record<string, any>;
  createdAt: string;
};

export default function AuditoriaPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setLoading(false);
      return;
    }
    apiFetch<AuditLog[]>("/audit?limit=200")
      .then(setItems)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Error cargando auditoría"),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <Protected>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Auditoría</h1>
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>ID</Th>
                  <Th>Acción</Th>
                  <Th>Usuario</Th>
                  <Th>Fecha</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <Td className="p-3" colSpan={4}>
                      Cargando...
                    </Td>
                  </tr>
                ) : error ? (
                  <tr>
                    <Td className="p-3 text-red-600" colSpan={4}>
                      {error}
                    </Td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <Td className="p-3" colSpan={4}>
                      No hay registros
                    </Td>
                  </tr>
                ) : (
                  items.map((log) => (
                    <tr key={log.id}>
                      <Td>{log.id}</Td>
                      <Td>{log.action}</Td>
                      <Td>{log.userId ?? "-"}</Td>
                      <Td>{new Date(log.createdAt).toLocaleString("es-PE")}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>
    </Protected>
  );
}
