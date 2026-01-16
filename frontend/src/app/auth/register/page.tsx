'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, User, Building, AlertCircle, CheckCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ exists: boolean; verified: boolean } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [acceptPolicy, setAcceptPolicy] = useState<boolean>(false);
  const [emailCheckError, setEmailCheckError] = useState<string | null>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    // Logs para diagnóstico (Terminal#151-177)
    console.log('Terminal#151-177:', logEntry);
  };

  const router = useRouter();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'email') setEmailStatus(null);
    validateField(name, value);
  };

  const validateField = (name: string, value: string) => {
    let msg = '';
    if (name === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) msg = 'Email inválido';
    }
    if (name === 'password') {
      if (value.length < 6) msg = 'La contraseña debe tener al menos 6 caracteres';
    }
    if (name === 'confirmPassword') {
      if (value !== formData.password) msg = 'Las contraseñas no coinciden';
    }
    if (name === 'name') {
      if (!value.trim()) msg = 'El nombre es requerido';
    }
    if (name === 'phone') {
      if (value && !/^\+51\s?(?:\d{9}|\(\d{2}\)\s?\d{7}|\d{3}\s?\d{6})$/.test(value)) {
        msg = 'Solo números con código de Perú (+51)';
      }
    }
    setFieldErrors(prev => ({ ...prev, [name]: msg }));
    return !msg;
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('El nombre es requerido');
      return false;
    }
    
    if (!formData.email.trim()) {
      setError('El email es requerido');
      return false;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Por favor ingrese un email válido');
      return false;
    }
    
    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return false;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return false;
    }
    if (formData.phone && !/^\+51\s?(?:\d{9}|\(\d{2}\)\s?\d{7}|\d{3}\s?\d{6})$/.test(formData.phone)) {
      setError('Solo números con código de Perú (+51)');
      return false;
    }
    
    return true;
  };

  useEffect(() => {
    const email = formData.email;
    if (!email || fieldErrors.email) return;
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      addLog(`Iniciando verificación de correo: ${email}`);
      try {
        setEmailCheckError(null);
        const res = await apiFetch('/auth/check-email', {
          method: 'POST',
          body: JSON.stringify({ email }),
          signal: ctrl.signal as any,
        });
        setEmailStatus(res);
        addLog(`Verificación de correo exitosa: ${email} (existe: ${res.exists})`);
      } catch (err: unknown) {
        setEmailStatus(null);
        const message =
          err instanceof Error && err.message
            ? err.message
            : 'Error de conexión al validar el correo';
        setEmailCheckError(message);
        addLog(`Error en verificación de correo: ${message}`);
        console.error('RegisterPage email check error', {
          email,
          error: err,
        });
      }
    }, 400);
    return () => {
      clearTimeout(id);
      ctrl.abort();
      addLog(`Limpiando verificación de correo: ${email}`);
    };
  }, [formData.email, fieldErrors.email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    addLog('Iniciando proceso de registro');
    
    if (!validateForm()) {
      addLog('Formulario inválido');
      return;
    }
    if (emailStatus?.exists) {
      addLog('Correo ya registrado');
      setError('El correo ya está registrado');
      return;
    }
    if (!acceptPolicy) {
      addLog('Política de privacidad no aceptada');
      setError('Debes aceptar la política de protección de datos');
      return;
    }
    
    addLog(`Registro iniciado para: ${formData.email}`);
    setIsLoading(true);

    try {
      console.log('RegisterPage submit start', {
        email: formData.email,
      });
      const registerResult = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          fullName: formData.name,
          phone: formData.phone,
        }),
      });
      addLog(`Registro exitoso para: ${formData.email} (ya existía: ${registerResult?.alreadyExists})`);
      if (registerResult?.alreadyExists) {
        setSuccess(
          registerResult?.emailSent
            ? 'Este correo ya estaba registrado. Reenviamos la verificación; revisa tu bandeja.'
            : 'Este correo ya estaba registrado. Intenta iniciar sesión o solicita reenvío.',
        );
      } else {
        setSuccess('Cuenta creada. Revisa tu correo para verificar y luego inicia sesión.');
      }
      addLog('Redirigiendo a página de inicio de sesión');
      setTimeout(() => {
        router.push('/auth/login');
      }, 2500);
    } catch (error: any) {
      addLog(`Error en registro: ${error.message}`);
      console.error('RegisterPage submit error', {
        email: formData.email,
        error,
      });
      let errorMessage = 'Error al crear la cuenta';
      if (typeof error?.message === 'string') {
        const lower = error.message.toLowerCase();
        if (
          lower.includes('failed to fetch') ||
          lower.includes('networkerror') ||
          lower.includes('econnrefused') ||
          lower.includes('enotfound') ||
          lower.includes('falloconsultando') ||
          lower.includes('timeout') ||
          lower.includes('fallo consultando')
        ) {
          errorMessage =
            'No se pudo conectar con el servidor. Verifica tu conexión o inténtalo más tarde.';
        } else {
          try {
            const parsed = JSON.parse(error.message);
            errorMessage = parsed?.message || parsed?.error || errorMessage;
          } catch {
            errorMessage = error.message;
          }
        }
      }
      if (
        errorMessage.toLowerCase().includes('correo') ||
        errorMessage.toLowerCase().includes('email') ||
        errorMessage.toLowerCase().includes('mail') ||
        errorMessage.toLowerCase().includes('confirmación')
      ) {
        errorMessage = 'Error al enviar el correo electrónico de confirmación';
      }
      if (
        errorMessage.toLowerCase().includes('ya está registrado') ||
        errorMessage.toLowerCase().includes('already')
      ) {
        errorMessage = 'Este correo ya está registrado';
      }
      setError(errorMessage);
    } finally {
      addLog('Proceso de registro completado');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-blue-900 mb-2">Industrias SP</h1>
          <h2 className="text-2xl font-bold text-gray-900">
            Crear Cuenta
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Regístrate para acceder a nuestros servicios exclusivos
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-lg rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md flex items-center">
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Nombre completo
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Juan Pérez"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Correo electrónico
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="tu@empresa.com"
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
                )}
                {emailStatus && (
                  <p
                    className={`mt-1 text-xs ${
                      emailStatus.exists ? 'text-red-600' : 'text-green-700'
                    }`}
                  >
                    {emailStatus.exists
                      ? 'Este correo ya está registrado'
                      : 'Correo disponible'}
                  </p>
                )}
                {emailCheckError && !emailStatus && (
                  <p className="mt-1 text-xs text-red-600">{emailCheckError}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="company" className="block text-sm font-medium text-gray-700">
                Empresa (opcional)
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="company"
                  name="company"
                  type="text"
                  value={formData.company}
                  onChange={handleInputChange}
                  className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nombre de tu empresa"
                />
              </div>
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Teléfono (solo Perú +51)
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+51 987654321"
                />
                {fieldErrors.phone && <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="appearance-none block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="••••••••"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none focus:text-gray-500"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Mínimo 6 caracteres
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirmar contraseña
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="appearance-none block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="••••••••"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none focus:text-gray-500"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>


            <div className="text-sm text-gray-600">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={acceptPolicy}
                  onChange={(e) => setAcceptPolicy(e.target.checked)}
                />
                Acepto la <a href="/legal/privacidad" className="text-blue-700 hover:underline">política de protección de datos</a>
              </label>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Creando cuenta...
                  </>
                ) : (
                  'Crear Cuenta'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  ¿Ya tienes una cuenta?
                </span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                href="/auth/login"
                className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                Iniciar Sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
