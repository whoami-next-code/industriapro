'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api';

export default function RegisterPage() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Estados de validación
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailExists, setEmailExists] = useState(false);

  // Validar nombre: solo letras y espacios
  const validateName = (name: string): boolean => {
    if (!name.trim()) {
      setNameError('El nombre es requerido');
      return false;
    }
    // Solo letras, espacios y acentos
    const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;
    if (!nameRegex.test(name)) {
      setNameError('El nombre solo puede contener letras y espacios');
      return false;
    }
    if (name.trim().length < 2) {
      setNameError('El nombre debe tener al menos 2 caracteres');
      return false;
    }
    setNameError('');
    return true;
  };

  // Validar correo electrónico
  const validateEmail = (emailValue: string): boolean => {
    if (!emailValue.trim()) {
      setEmailError('El correo electrónico es requerido');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue)) {
      setEmailError('Ingresa un correo electrónico válido');
      return false;
    }
    setEmailError('');
    return true;
  };

  // Verificar si el correo ya está registrado
  const checkEmailExists = async (emailValue: string) => {
    if (!validateEmail(emailValue)) return;
    
    setCheckingEmail(true);
    try {
      const result = await apiFetch<{ exists: boolean; verified: boolean }>('/auth/check-email', {
        method: 'POST',
        body: JSON.stringify({ email: emailValue.trim() }),
      });
      
      if (result.exists) {
        setEmailExists(true);
        setEmailError('Este correo electrónico ya está registrado');
        return false;
      } else {
        setEmailExists(false);
        setEmailError('');
        return true;
      }
    } catch (err: any) {
      console.warn('Error verificando correo:', err);
      // Si falla la verificación, permitir continuar
      setEmailError('');
      return true;
    } finally {
      setCheckingEmail(false);
    }
  };

  // Validar contraseña segura
  const validatePassword = (pass: string): boolean => {
    if (!pass) {
      setPasswordError('La contraseña es requerida');
      return false;
    }
    if (pass.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres');
      return false;
    }
    if (!/[A-Z]/.test(pass)) {
      setPasswordError('La contraseña debe contener al menos una mayúscula');
      return false;
    }
    if (!/[a-z]/.test(pass)) {
      setPasswordError('La contraseña debe contener al menos una minúscula');
      return false;
    }
    if (!/[0-9]/.test(pass)) {
      setPasswordError('La contraseña debe contener al menos un número');
      return false;
    }
    if (!/[^A-Za-z0-9]/.test(pass)) {
      setPasswordError('La contraseña debe contener al menos un carácter especial');
      return false;
    }
    setPasswordError('');
    return true;
  };

  // Validar confirmación de contraseña
  const validateConfirm = (confirmValue: string): boolean => {
    if (!confirmValue) {
      setConfirmError('Confirma tu contraseña');
      return false;
    }
    if (confirmValue !== password) {
      setConfirmError('Las contraseñas no coinciden');
      return false;
    }
    setConfirmError('');
    return true;
  };

  // Validar nombre mientras se escribe
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Filtrar números y caracteres especiales en tiempo real
    const filtered = value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '');
    setFullName(filtered);
    if (filtered !== value) {
      // Si se filtró algo, validar inmediatamente
      validateName(filtered);
    }
  };

  // Verificar correo cuando el usuario termine de escribir
  useEffect(() => {
    const timer = setTimeout(() => {
      if (email.trim() && validateEmail(email)) {
        checkEmailExists(email);
      }
    }, 500); // Esperar 500ms después de que el usuario deje de escribir

    return () => clearTimeout(timer);
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validar todos los campos
    const isNameValid = validateName(fullName);
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);
    const isConfirmValid = validateConfirm(confirm);

    if (!isNameValid || !isEmailValid || !isPasswordValid || !isConfirmValid) {
      setError('Por favor, corrige los errores en el formulario');
      return;
    }

    // Verificar nuevamente si el correo existe antes de registrar
    const emailAvailable = await checkEmailExists(email);
    if (!emailAvailable) {
      return;
    }

    setLoading(true);
    try {
      await signUp(email.trim(), password, { fullName: fullName.trim() });
      setSuccess(
        'Cuenta creada. Revisa tu correo para confirmar y luego inicia sesión.',
      );
      // Limpiar formulario
      setFullName('');
      setEmail('');
      setPassword('');
      setConfirm('');
    } catch (err: any) {
      setError(err?.message || 'No se pudo crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h1 className="text-3xl font-bold text-blue-900 mb-2">Industrias SP</h1>
        <h2 className="text-2xl font-bold text-gray-900">Crear cuenta</h2>
        <p className="mt-2 text-sm text-gray-600">
          Regístrate y confirma tu correo para activar tu cuenta.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-lg rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
              {success}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nombre completo
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={handleNameChange}
                onBlur={() => validateName(fullName)}
                className={`mt-1 w-full border rounded-lg px-3 py-2 ${
                  nameError
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    : fullName && !nameError
                    ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                    : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder="Tu nombre completo"
              />
              {nameError && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  {nameError}
                </p>
              )}
              {fullName && !nameError && (
                <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Nombre válido
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Correo electrónico
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => {
                    if (email.trim()) {
                      validateEmail(email);
                      checkEmailExists(email);
                    }
                  }}
                  className={`mt-1 w-full border rounded-lg px-3 py-2 ${
                    emailError
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : email && !emailError && !checkingEmail && !emailExists
                      ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  placeholder="tu@correo.com"
                />
                {checkingEmail && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  </div>
                )}
              </div>
              {emailError && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  {emailError}
                </p>
              )}
              {email && !emailError && !checkingEmail && !emailExists && (
                <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Correo disponible
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <div className="mt-1 relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (confirm) validateConfirm(confirm);
                  }}
                  onBlur={() => validatePassword(password)}
                  className={`w-full border rounded-lg px-3 py-2 pr-10 ${
                    passwordError
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : password && !passwordError
                      ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {passwordError && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  {passwordError}
                </p>
              )}
              {password && !passwordError && (
                <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Contraseña segura
                </p>
              )}
              {password && (
                <div className="mt-2 text-xs text-gray-600">
                  <p className="mb-1">La contraseña debe contener:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li className={password.length >= 8 ? 'text-green-600' : ''}>
                      Al menos 8 caracteres
                    </li>
                    <li className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>
                      Una mayúscula
                    </li>
                    <li className={/[a-z]/.test(password) ? 'text-green-600' : ''}>
                      Una minúscula
                    </li>
                    <li className={/[0-9]/.test(password) ? 'text-green-600' : ''}>
                      Un número
                    </li>
                    <li className={/[^A-Za-z0-9]/.test(password) ? 'text-green-600' : ''}>
                      Un carácter especial (!@#$%^&*)
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Confirmar contraseña
              </label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  if (e.target.value) validateConfirm(e.target.value);
                }}
                onBlur={() => validateConfirm(confirm)}
                className={`mt-1 w-full border rounded-lg px-3 py-2 ${
                  confirmError
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                    : confirm && !confirmError
                    ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                    : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                }`}
                placeholder="••••••••"
              />
              {confirmError && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  {confirmError}
                </p>
              )}
              {confirm && !confirmError && (
                <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Las contraseñas coinciden
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          <div className="mt-4 text-sm text-center text-gray-600">
            ¿Ya tienes cuenta?{' '}
            <Link href="/auth/login" className="text-blue-600 hover:text-blue-500">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
