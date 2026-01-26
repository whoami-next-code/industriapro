"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import Protected from "@/lib/Protected";
import Card from "@/components/ui/Card";
import Table, { Th, Td } from "@/components/ui/Table";
import { KeyIcon, TrashIcon } from "@heroicons/react/24/outline";
import Modal from "@/components/modals/Modal";

type User = {
  id: number;
  email: string;
  role: string;
  fullName?: string;
  verified: boolean;
  status?: string;
  active: boolean;
  mustChangePassword?: boolean;
};

type CreateUserForm = {
  fullName: string;
  email: string;
  role: string;
  active: boolean;
};

export default function AdminUsuarios() {
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [form, setForm] = useState<CreateUserForm>({
    fullName: "",
    email: "",
    role: "TECNICO",
    active: true,
  });

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) { setLoading(false); return; }
    setError(null);
    apiFetch<{ role: string }>('/auth/profile')
      .then((p) => setProfileRole(p.role))
      .catch(() => setProfileRole(null));
    apiFetch<User[]>('/users')
      .then(setItems)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error cargando usuarios'))
      .finally(() => setLoading(false));
  }, []);

  async function changeRole(id: number, role: string) {
    try {
      const updated = await apiFetch<{ role: string }>(`/users/${id}`, { method: 'PUT', body: JSON.stringify({ role }) });
      setItems(prev => prev.map(u => u.id === id ? { ...u, role: updated.role } : u));
    } catch {
      alert('No se pudo actualizar el rol');
    }
  }

  async function changeActive(id: number, active: boolean) {
    try {
      const updated = await apiFetch<{ active: boolean }>(`/users/${id}`, { method: 'PUT', body: JSON.stringify({ active }) });
      setItems(prev => prev.map(u => u.id === id ? { ...u, active: updated.active } : u));
    } catch {
      alert('No se pudo actualizar el estado');
    }
  }

  async function changeStatus(id: number, status: string) {
    try {
      const updated = await apiFetch<{ status: string }>(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      setItems(prev => prev.map(u => u.id === id ? { ...u, status: updated.status } : u));
    } catch {
      alert('No se pudo actualizar el estado de cuenta');
    }
  }

  async function createUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    setTempPassword(null);
    try {
      const created = await apiFetch<{ user: User; tempPassword: string }>(
        '/auth/admin/create-user',
        {
          method: 'POST',
          body: JSON.stringify({
            email: form.email,
            fullName: form.fullName,
            role: form.role,
            active: form.active,
          }),
        },
      );
      setItems(prev => [created.user, ...prev]);
      setTempPassword(created.tempPassword);
      setForm({ fullName: "", email: "", role: "TECNICO", active: true });
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Error creando usuario');
    } finally {
      setCreating(false);
    }
  }

  function openDelete(user: User) {
    setDeleteTarget(user);
    setShowDeleteModal(true);
  }

  async function deleteUser() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/users/${deleteTarget.id}`, { method: "DELETE" });
      setItems(prev => prev.filter(u => u.id !== deleteTarget.id));
      setShowDeleteModal(false);
      setDeleteTarget(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al eliminar usuario");
    } finally {
      setDeleting(false);
    }
  }

  function openReset(user: User) {
    setResetTarget(user);
    setShowResetModal(true);
  }

  async function sendReset() {
    if (!resetTarget) return;
    setResetting(true);
    try {
      await apiFetch("/auth/admin/reset-password", {
        method: "POST",
        body: JSON.stringify({ email: resetTarget.email }),
      });
      alert(`Se envio el correo de restablecimiento a ${resetTarget.email}`);
      setShowResetModal(false);
      setResetTarget(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "No se pudo enviar el correo");
    } finally {
      setResetting(false);
    }
  }

  }

  return (
    <Protected>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Usuarios</h1>
        <Card>
          <form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <label className="sp-form-label">Nombre completo</label>
              <input
                type="text"
                className="sp-input"
                value={form.fullName}
                onChange={(e) => setForm(prev => ({ ...prev, fullName: e.target.value }))}
                placeholder="Ej. Juan Pérez"
                required
              />
            </div>
            <div className="md:col-span-1">
              <label className="sp-form-label">Email</label>
              <input
                type="email"
                className="sp-input"
                value={form.email}
                onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="usuario@empresa.com"
                required
              />
            </div>
            <div className="md:col-span-1">
              <label className="sp-form-label">Rol</label>
              <select
                className="sp-select"
                value={form.role}
                onChange={(e) => setForm(prev => ({ ...prev, role: e.target.value }))}
              >
                {profileRole === 'SUPERADMIN' && <option value="SUPERADMIN">SUPERADMIN</option>}
                {profileRole === 'SUPERADMIN' && <option value="ADMIN">ADMIN</option>}
                <option value="VENDEDOR">VENDEDOR</option>
                <option value="TECNICO">TECNICO</option>
                <option value="OPERARIO">OPERARIO</option>
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="sp-form-label">Estado</label>
              <select
                className="sp-select"
                value={form.active ? '1' : '0'}
                onChange={(e) => setForm(prev => ({ ...prev, active: e.target.value === '1' }))}
              >
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>
            </div>
            <div className="md:col-span-4 flex items-center gap-3">
              <button
                type="submit"
                disabled={creating}
                className="sp-button sp-button-primary"
              >
                {creating ? 'Creando...' : 'Crear usuario'}
              </button>
              {tempPassword && (
                <div className="text-sm text-emerald-700">
                  Contraseña temporal: <span className="font-semibold">{tempPassword}</span>
                </div>
              )}
              {createError && <div className="text-sm text-red-600">{createError}</div>}
            </div>
          </form>
        </Card>
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>ID</Th>
                  <Th>Nombre</Th>
                  <Th>Email</Th>
                  <Th>Estado</Th>
                  <Th>Cuenta</Th>
                  <Th>Rol</Th>
                  <Th>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><Td className="p-3" colSpan={7}>Cargando...</Td></tr>
                ) : error ? (
                  <tr><Td className="p-3 text-red-600" colSpan={7}>{error}</Td></tr>
                ) : items.length === 0 ? (
                  <tr><Td className="p-3" colSpan={7}>No hay usuarios</Td></tr>
                ) : items.map(u => (
                  <tr key={u.id}>
                    <Td>{u.id}</Td>
                    <Td>{u.fullName || '-'}</Td>
                    <Td>{u.email}</Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <span className={`sp-badge ${u.active ? 'sp-badge--secondary' : 'sp-badge--accent'}`}>
                          {u.active ? 'Activo' : 'Inactivo'}
                        </span>
                        <span className={`sp-badge ${u.verified ? 'sp-badge--secondary' : 'sp-badge--accent'}`}>
                          {u.verified ? 'Verificado' : 'Pendiente'}
                        </span>
                        {u.mustChangePassword ? (
                          <span className="sp-badge sp-badge--accent">Cambiar clave</span>
                        ) : null}
                      </div>
                    </Td>
                    <Td>
                      <select
                        className="sp-select text-sm"
                        value={u.status || (u.verified ? 'VERIFIED' : 'PENDING')}
                        onChange={(e) => changeStatus(u.id, e.target.value)}
                      >
                        <option value="PENDING">PENDIENTE</option>
                        <option value="VERIFIED">VERIFICADO</option>
                        <option value="SUSPENDED">SUSPENDIDO</option>
                      </select>
                    </Td>
                    <Td>{u.role}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <select 
                          className="sp-select text-sm" 
                          value={u.role} 
                          onChange={(e) => changeRole(u.id, e.target.value)}
                          disabled={u.role === "CLIENTE"}
                        >
                          {profileRole === 'SUPERADMIN' && <option value="SUPERADMIN">SUPERADMIN</option>}
                          {profileRole === 'SUPERADMIN' && <option value="ADMIN">ADMIN</option>}
                          <option value="VENDEDOR">VENDEDOR</option>
                          <option value="TECNICO">TECNICO</option>
                          <option value="OPERARIO">OPERARIO</option>
                          <option value="CLIENTE">CLIENTE</option>
                        </select>
                        <select
                          className="sp-select text-sm"
                          value={u.active ? '1' : '0'}
                          onChange={(e) => changeActive(u.id, e.target.value === '1')}
                        >
                          <option value="1">Activo</option>
                          <option value="0">Inactivo</option>
                        </select>
                        {u.role !== "CLIENTE" && (
                          <button
                            onClick={() => openReset(u)}
                            className="sp-button sp-button-ghost h-9 w-9 !p-0 text-sky-500 hover:text-sky-600"
                            title="Restablecer contrase??a"
                          >
                            <KeyIcon className="w-5 h-5" />
                          </button>
                        )}
                        <button 
                          onClick={() => openDelete(u)}
                          className="sp-button sp-button-ghost h-9 w-9 !p-0 text-rose-500 hover:text-rose-600"
                          title="Eliminar usuario"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Eliminar usuario"
        size="sm"
      >
        <div className="space-y-3 text-sm">
          <p>
            Vas a eliminar a {" "}
            <strong>{deleteTarget?.fullName || deleteTarget?.email}</strong>.
          </p>
          <p className="sp-muted">
            Esta accion es irreversible y eliminara el acceso del usuario al
            sistema.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              className="sp-button sp-button-ghost"
              onClick={() => setShowDeleteModal(false)}
              disabled={deleting}
            >
              Cancelar
            </button>
            <button
              className="sp-button sp-button-primary"
              onClick={deleteUser}
              disabled={deleting}
            >
              {deleting ? "Eliminando..." : "Eliminar usuario"}
            </button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Restablecer contrase??a"
        size="sm"
      >
        <div className="space-y-3 text-sm">
          <p>
            Se enviara un correo de restablecimiento a {" "}
            <strong>{resetTarget?.email}</strong>.
          </p>
          <p className="sp-muted">
            El usuario debera crear una nueva contrasena desde el enlace
            recibido.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              className="sp-button sp-button-ghost"
              onClick={() => setShowResetModal(false)}
              disabled={resetting}
            >
              Cancelar
            </button>
            <button
              className="sp-button sp-button-primary"
              onClick={sendReset}
              disabled={resetting}
            >
              {resetting ? "Enviando..." : "Enviar correo"}
            </button>
          </div>
        </div>
      </Modal>
    </Protected>
  );
}

