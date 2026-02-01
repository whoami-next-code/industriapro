"use client";
import React, { useMemo, useState, useEffect, Suspense } from "react";
import axios from "axios";
import { useCart } from "@/components/cart/CartContext";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Truck, 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  ArrowLeft,
  Clock,
  MapPin,
  User,
  FileText,
  ShoppingCart
} from "lucide-react";
import DocumentInput from '@/components/DocumentInput';
import OwnerAutocomplete from '@/components/OwnerAutocomplete';
import { apiFetchAuth, requireAuthOrRedirect, getImageUrl, API_URL } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = API_URL;
// Marca visual para confirmar que el deploy trae los últimos cambios
const PASARELA_BUILD_TAG = "2026-01-23-phone9-autocomplete-v2";

function validarRUC(ruc: string) {
  const clean = (ruc || '').replace(/[^0-9]/g, '');
  if (clean.length !== 11) return false;
  const w = [5,4,3,2,7,6,5,4,3,2];
  let sum = 0; 
  for (let i=0;i<10;i++){ 
    const d = Number(clean[i]); 
    if (Number.isNaN(d)) return false; 
    sum += d*w[i]; 
  }
  const r = sum % 11; 
  let c = 11 - r; 
  if (c===10) c=0; 
  if (c===11) c=1; 
  return c === Number(clean[10]);
}

function validarDNI(dni: string) {
  const clean = (dni || '').replace(/[^0-9]/g, '');
  return clean.length === 8;
}

type PaymentMethod = 'cash_on_delivery' | 'fake';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    Number(value || 0)
  );

const formatDateTime = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const defaultComprobante = {
  companyInfo: {
    name: "IndustriaSP",
    ruc: "20123456789",
    address: "Av. Industrial 123, Lima, Perú",
    phone: "+51 1 234-5678",
    email: "ventas@industriasp.com",
  },
  paymentInfo: {
    method: "Pago contra entrega",
    status: "Pendiente",
  },
  totals: { subtotal: 0, shipping: 0, total: 0 },
  items: [],
};

const renderComprobante = (doc: any, title: string) => {
  const data = {
    ...defaultComprobante,
    ...(doc || {}),
    companyInfo: { ...defaultComprobante.companyInfo, ...(doc?.companyInfo || {}) },
    paymentInfo: { ...defaultComprobante.paymentInfo, ...(doc?.paymentInfo || {}) },
    totals: { ...defaultComprobante.totals, ...(doc?.totals || {}) },
  };
  const pdfUrl = data.pdfUrl || data.enlace_pdf || data.raw?.enlace_pdf;
  const items = Array.isArray(data.items) ? data.items : [];

  return (
    <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-dashed border-gray-200 pb-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-gray-400">Comprobante electrónico</div>
          <h4 className="text-lg font-semibold text-gray-900">{title}</h4>
          <p className="text-xs text-gray-500">
            {data.source === 'NUBEFACT' ? 'Documento Nubefact' : 'Documento generado automáticamente'}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-right text-xs text-gray-600">
          <div className="font-semibold text-gray-900">N° {data.id || "—"}</div>
          <div>Orden: {data.orderNumber || "—"}</div>
          <div>Emisión: {data.issueDate ? formatDateTime(data.issueDate) : "—"}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Empresa</div>
          <div className="mt-2 text-sm font-semibold text-gray-900">{data.companyInfo?.name}</div>
          <div className="mt-1 text-xs text-gray-600">RUC: {data.companyInfo?.ruc}</div>
          <div className="text-xs text-gray-600">{data.companyInfo?.address}</div>
          <div className="text-xs text-gray-600">{data.companyInfo?.phone}</div>
          <div className="text-xs text-gray-600">{data.companyInfo?.email}</div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Cliente</div>
          <div className="mt-2 text-sm font-semibold text-gray-900">{data.customerInfo?.name || "—"}</div>
          <div className="mt-1 text-xs text-gray-600">
            {data.customerInfo?.documentType || "DOC"}: {data.customerInfo?.document || "—"}
          </div>
          <div className="text-xs text-gray-600">{data.customerInfo?.email || ""}</div>
          <div className="text-xs text-gray-600">{data.customerInfo?.phone || ""}</div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="grid grid-cols-[1.2fr_0.4fr_0.6fr_0.6fr] gap-2 bg-slate-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-600">
          <div>Descripción</div>
          <div className="text-right">Cant.</div>
          <div className="text-right">P. Unit</div>
          <div className="text-right">Total</div>
        </div>
        <div className="divide-y divide-gray-100">
          {items.length === 0 && (
            <div className="px-4 py-3 text-xs text-gray-500">Sin ítems registrados.</div>
          )}
          {items.map((item: any, idx: number) => (
            <div
              key={`${item?.description || item?.name || "item"}-${idx}`}
              className="grid grid-cols-[1.2fr_0.4fr_0.6fr_0.6fr] gap-2 px-4 py-3 text-sm text-gray-700"
            >
              <div className="font-medium text-gray-900">
                {item?.description || item?.name || "Producto"}
              </div>
              <div className="text-right text-gray-600">{item?.quantity ?? item?.cantidad ?? 0}</div>
              <div className="text-right text-gray-600">
                {formatCurrency(item?.unitPrice ?? item?.price ?? 0)}
              </div>
              <div className="text-right font-semibold text-gray-900">
                {formatCurrency(item?.total ?? 0)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Pago</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-gray-700">
              {data.paymentInfo?.method || "—"}
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {data.paymentInfo?.status || "—"}
            </span>
          </div>
          {data.hash && (
            <div className="mt-3 text-[11px] text-gray-500">
              Hash: <span className="font-mono">{data.hash}</span>
            </div>
          )}
          {pdfUrl && (
            <div className="mt-3 text-xs">
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="underline text-blue-700">
                Ver PDF Nubefact
              </a>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Totales</div>
          <div className="mt-2 space-y-2 text-sm text-gray-700">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span className="font-medium text-gray-900">{formatCurrency(data.totals?.subtotal ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Envío</span>
              <span className="font-medium text-gray-900">{formatCurrency(data.totals?.shipping ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-dashed border-gray-200 pt-2 text-base font-semibold text-gray-900">
              <span>Total</span>
              <span>{formatCurrency(data.totals?.total ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-xs text-gray-500">
          Este comprobante es válido para fines informativos y puede verificarse con el código de seguridad.
        </div>
        {data.qrCode ? (
          <img
            src={data.qrCode}
            alt="QR"
            className="h-16 w-16 rounded border border-gray-200 bg-white p-1"
          />
        ) : (
          <div className="h-16 w-16 rounded border border-dashed border-gray-300 bg-slate-50 text-[10px] text-gray-400 flex items-center justify-center">
            QR
          </div>
        )}
      </div>
    </div>
  );
};

function CheckoutForm() {
  const { items, total, isHydrated, clear } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  
  // Estados principales
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash_on_delivery');
  const [ruc, setRuc] = useState("");
  const [dni, setDni] = useState("");
  const [documentType, setDocumentType] = useState<'dni' | 'ruc'>('dni');
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  
  const [customerData, setCustomerData] = useState({
    name: '',
    email: '',
    phone: '',
    dni: '',
    address: ''
  });
  const [documentValidation, setDocumentValidation] = useState({
    isValid: false,
    documentType: null as 'DNI' | 'RUC' | null
  });
  
  // Estados de UI
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [facturaDoc, setFacturaDoc] = useState<any | null>(null);
  const [comprobanteDoc, setComprobanteDoc] = useState<any | null>(null);
  const [result, setResult] = useState<any | null>(null);
  
  // Estados de validación
  const [documentError, setDocumentError] = useState("");
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [addressError, setAddressError] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardErrors, setCardErrors] = useState({
    number: "",
    name: "",
    expiry: "",
    cvc: "",
  });

  // Autocompletado: estado, carga, cache
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [autoData, setAutoData] = useState<any | null>(null);
  const cacheRef = React.useRef<Map<string, any>>(new Map());

  const currentStep: 1 | 2 | 3 = success ? 3 : (facturaDoc || comprobanteDoc) ? 2 : 1;
  const stepCircleClass = (n: number) =>
    `flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
      currentStep > n
        ? 'bg-green-600 text-white'
        : currentStep === n
          ? 'bg-blue-600 text-white'
          : 'bg-gray-300 text-gray-600'
    }`;
  const stepTextClass = (n: number) =>
    currentStep >= n ? 'text-blue-700' : 'text-gray-500';
  const stepBarClass = (from: number) =>
    `w-16 h-0.5 ${currentStep > from ? 'bg-blue-600' : 'bg-gray-300'}`;

  // Recuperar datos del sessionStorage
  useEffect(() => {
    requireAuthOrRedirect('/pasarela');
    const orderSummary = sessionStorage.getItem("last_order_summary");
    if (orderSummary) {
      try {
        const data = JSON.parse(orderSummary);
        if (data.shippingAddress) {
          setShippingAddress(data.shippingAddress);
        }
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.warn("Error parsing order summary:", e);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!customerEmail && user?.email) {
      setCustomerEmail(user.email);
    }
  }, [customerEmail, user?.email]);

  const itemsPayload = useMemo(
    () =>
      items.map((it) => ({
        productId: it.productId,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        imageUrl: it.imageUrl,
        thumbnailUrl: it.thumbnailUrl,
        // Compatibilidad con payloads anteriores
        nombre: it.name,
        precioUnitario: it.price,
        cantidad: it.quantity,
      })),
    [items],
  );

  // Validaciones
  const validateDocument = () => {
    // Usar el resultado del nuevo componente DocumentInput
    if (!documentValidation.isValid) {
      // Mensaje acorde al tipo detectado
      const msg = documentValidation.documentType === 'DNI'
        ? 'DNI inválido'
        : documentValidation.documentType === 'RUC'
          ? 'RUC inválido'
          : 'Documento inválido';
      setDocumentError(msg);
      return false;
    }
    setDocumentError("");
    return true;
  };

  const validateName = () => {
    if (!customerName.trim() || customerName.trim().length < 2) {
      setNameError("Nombre completo es obligatorio");
      return false;
    }
    setNameError("");
    return true;
  };

  const validatePhone = () => {
    if (!customerPhone.trim() || customerPhone.trim().length < 9) {
      setPhoneError("Teléfono debe tener al menos 9 dígitos");
      return false;
    }
    setPhoneError("");
    return true;
  };

  const validateEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!customerEmail.trim()) {
      setEmailError("Email es requerido para enviar el comprobante");
      return false;
    }
    if (!emailRegex.test(customerEmail.trim())) {
      setEmailError("Email inválido");
      return false;
    }
    setEmailError("");
    return true;
  };

  const validateAddress = () => {
    if (!shippingAddress.trim() || shippingAddress.trim().length < 10) {
      setAddressError("Dirección debe tener al menos 10 caracteres");
      return false;
    }
    setAddressError("");
    return true;
  };

  const getCardDigits = (value: string) => value.replace(/\D/g, '').slice(0, 19);

  const detectCardBrand = (digits: string) => {
    if (/^3[47]/.test(digits)) return 'American Express';
    if (/^4/.test(digits)) return 'Visa';
    if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
    if (/^(6011|65|64[4-9]|622)/.test(digits)) return 'Discover';
    return 'Tarjeta';
  };

  const formatCardNumber = (digits: string) => {
    const isAmex = /^3[47]/.test(digits);
    if (isAmex) {
      const p1 = digits.slice(0, 4);
      const p2 = digits.slice(4, 10);
      const p3 = digits.slice(10, 15);
      return [p1, p2, p3].filter(Boolean).join(' ');
    }
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  };

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  };

  const luhnCheck = (digits: string) => {
    let sum = 0;
    let shouldDouble = false;
    for (let i = digits.length - 1; i >= 0; i -= 1) {
      let n = Number(digits[i]);
      if (Number.isNaN(n)) return false;
      if (shouldDouble) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  };

  const validateCardNumber = () => {
    const digits = getCardDigits(cardNumber);
    if (digits.length < 13) {
      setCardErrors((prev) => ({ ...prev, number: "Número de tarjeta incompleto" }));
      return false;
    }
    if (!luhnCheck(digits)) {
      setCardErrors((prev) => ({ ...prev, number: "Número de tarjeta inválido" }));
      return false;
    }
    setCardErrors((prev) => ({ ...prev, number: "" }));
    return true;
  };

  const validateCardName = () => {
    if (!cardName.trim() || cardName.trim().length < 3) {
      setCardErrors((prev) => ({ ...prev, name: "Nombre del titular es requerido" }));
      return false;
    }
    setCardErrors((prev) => ({ ...prev, name: "" }));
    return true;
  };

  const validateCardExpiry = () => {
    const match = cardExpiry.match(/^(\d{2})\/(\d{2})$/);
    if (!match) {
      setCardErrors((prev) => ({ ...prev, expiry: "Fecha inválida (MM/YY)" }));
      return false;
    }
    const month = Number(match[1]);
    const year = Number(match[2]) + 2000;
    if (month < 1 || month > 12) {
      setCardErrors((prev) => ({ ...prev, expiry: "Mes inválido" }));
      return false;
    }
    const expiryDate = new Date(year, month, 0, 23, 59, 59);
    if (expiryDate < new Date()) {
      setCardErrors((prev) => ({ ...prev, expiry: "Tarjeta vencida" }));
      return false;
    }
    setCardErrors((prev) => ({ ...prev, expiry: "" }));
    return true;
  };

  const validateCardCvc = () => {
    const digits = cardCvc.replace(/\D/g, '');
    const brand = detectCardBrand(getCardDigits(cardNumber));
    const expected = brand === 'American Express' ? 4 : 3;
    if (digits.length !== expected) {
      setCardErrors((prev) => ({ ...prev, cvc: `CVC debe tener ${expected} dígitos` }));
      return false;
    }
    setCardErrors((prev) => ({ ...prev, cvc: "" }));
    return true;
  };

  const validateFakePayment = () => {
    const isNumberValid = validateCardNumber();
    const isNameValid = validateCardName();
    const isExpiryValid = validateCardExpiry();
    const isCvcValid = validateCardCvc();
    return isNumberValid && isNameValid && isExpiryValid && isCvcValid;
  };

  const validateForm = () => {
    const isDocumentValid = validateDocument();
    const isNameValid = validateName();
    const isPhoneValid = validatePhone();
    const isEmailValid = validateEmail();
    const isAddressValid = validateAddress();
    const isFakeValid = paymentMethod === 'fake' ? validateFakePayment() : true;
    
    return isDocumentValid && isNameValid && isPhoneValid && isEmailValid && isAddressValid && isFakeValid;
  };

  // Debounced autocompletado desde API interna protegida
  useEffect(() => {
    console.error('[Pasarela] 🔄 useEffect AUTocomplete EJECUTADO');
    console.log('[Pasarela] 🔄 useEffect AUTocomplete EJECUTADO');
    
    const doc = documentType === 'dni' ? dni : ruc;
    const cleanDoc = (doc || '').replace(/[^0-9]/g, '');
    
    console.error('[Pasarela] Estado:', {
      documentType,
      doc,
      cleanDoc,
      cleanDocLength: cleanDoc.length,
      documentValidation,
      isValid: documentValidation.isValid,
    });
    console.log('[Pasarela] Estado:', {
      documentType,
      doc,
      cleanDoc,
      cleanDocLength: cleanDoc.length,
      documentValidation,
      isValid: documentValidation.isValid,
    });
    
    setAutoError(null);

    const isValidLength = cleanDoc.length === 8 || cleanDoc.length === 11;

    if (!isValidLength || !cleanDoc) {
      console.error('[Pasarela] ❌ Longitud inválida:', cleanDoc.length);
      console.log('[Pasarela] ❌ Longitud inválida:', cleanDoc.length);
      setAutoLoading(false);
      setAutoData(null);
      return;
    }

    // Ejecutar autocomplete si el documento tiene la longitud correcta
    // No esperar a documentValidation.isValid para permitir que funcione
    if (!documentValidation.isValid) {
      console.error('[Pasarela] ⏳ Validación pendiente, pero continuando con autocomplete...');
      console.log('[Pasarela] ⏳ Validación pendiente, pero continuando con autocomplete...');
      // No retornar, continuar con el autocomplete
    }

    setAutoLoading(true);
    const t = setTimeout(async () => {
      try {
        const url = `/api/clientes/autocomplete?doc=${encodeURIComponent(cleanDoc)}`;
        console.error('[Pasarela] 🌐 Iniciando fetch a:', url);
        console.log('[Pasarela] 🌐 Iniciando fetch a:', url);
        
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        console.error('[Pasarela] 📥 Respuesta recibida - status:', res.status, res.statusText);
        console.log('[Pasarela] 📥 Respuesta recibida - status:', res.status, res.statusText);

        if (!res.ok) {
          const errorText = await res.text();
          console.error('[Pasarela] ❌ Error en respuesta:', errorText);
          throw new Error(errorText || `Error ${res.status}: ${res.statusText}`);
        }
        
        const data = await res.json();
        console.error('[Pasarela] 📦 Datos recibidos:', JSON.stringify(data, null, 2));
        console.log('[Pasarela] 📦 Datos recibidos:', JSON.stringify(data, null, 2));

        cacheRef.current.set(cleanDoc, data);
        try {
          sessionStorage.setItem(`doc_cache_${cleanDoc}`, JSON.stringify(data));
        } catch (e) {
          console.warn("Error writing to sessionStorage:", e);
        }

        setAutoData(data);
        const isGeneric = (v: any) => {
          const s = String(v || '').trim().toLowerCase();
          return !s || s === 'cliente' || s === 'empresa' || s === 'demo' || s === 'test' || s.length < 4;
        };

        if (data?.type === 'DNI') {
          const candidate = data.name ?? data.nombre ?? data.fullName ?? '';
          if (isGeneric(candidate)) {
            console.error('[Pasarela] ⚠️ DNI sin nombre válido en respuesta. No se autocompleta.', { candidate, data });
            console.log('[Pasarela] ⚠️ DNI sin nombre válido en respuesta. No se autocompleta.', { candidate, data });
            setAutoError('No se pudo obtener el nombre del DNI. Verifica el número o la configuración del backend.');
          } else {
            console.error('[Pasarela] ✏️ Estableciendo nombre DNI:', candidate);
            console.log('[Pasarela] ✏️ Estableciendo nombre DNI:', candidate);
            setCustomerName(String(candidate));
          }
        } else if (data?.type === 'RUC') {
          const candidate = data.businessName ?? data.razonSocial ?? data.razon_social ?? data.nombreComercial ?? '';
          if (isGeneric(candidate)) {
            console.error('[Pasarela] ⚠️ RUC sin razón social válida en respuesta. No se autocompleta.', { candidate, data });
            console.log('[Pasarela] ⚠️ RUC sin razón social válida en respuesta. No se autocompleta.', { candidate, data });
            setAutoError('No se pudo obtener la razón social del RUC. Verifica el número o la configuración del backend.');
          } else {
            console.error('[Pasarela] ✏️ Estableciendo razón social RUC:', candidate);
            console.log('[Pasarela] ✏️ Estableciendo razón social RUC:', candidate);
            setCustomerName(String(candidate));
            
            // Autocompletar dirección si está disponible
            const address = data.address ?? data.direccion ?? data.direccionCompleta ?? '';
            if (address && !isGeneric(address) && address.length > 5) {
              console.log('[Pasarela] ✏️ Estableciendo dirección RUC:', address);
              setShippingAddress(String(address));
            }
            
            // Autocompletar teléfono si está disponible (representante legal)
            const phone = data.phone ?? data.telefono ?? data.representantesLegales?.[0]?.telefono ?? '';
            if (phone && !customerPhone) {
              const cleanPhone = String(phone).replace(/[^0-9]/g, '').slice(0, 9);
              if (cleanPhone.length === 9) {
                console.log('[Pasarela] ✏️ Estableciendo teléfono RUC:', cleanPhone);
                setCustomerPhone(cleanPhone);
        }
            }
          }
        } else {
          console.error('[Pasarela] ⚠️ Respuesta inesperada de autocomplete (sin type).', data);
          console.log('[Pasarela] ⚠️ Respuesta inesperada de autocomplete (sin type).', data);
          setAutoError('Respuesta inesperada del servicio de autocomplete.');
        }
      } catch (e: any) {
        console.error('[Pasarela] ❌ Error en autocomplete:', e);
        console.log('[Pasarela] ❌ Error en autocomplete:', e);
        setAutoError(e?.message || 'No se pudo obtener datos');
      } finally {
        setAutoLoading(false);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [documentType, dni, ruc, documentValidation.isValid]);
  
  const handleDocumentChange = (value: string) => {
    const cleanValue = value.replace(/[^0-9]/g, '');
    const isRuc = cleanValue.length > 8 || cleanValue.startsWith('20') || cleanValue.startsWith('10');
    
    if (isRuc) {
      setDocumentType('ruc');
      setRuc(cleanValue);
      setDni('');
    } else {
      setDocumentType('dni');
      setDni(cleanValue);
      setRuc('');
    }
  };

  const handleValidationChange = (isValid: boolean, documentType: 'DNI' | 'RUC' | null) => {
    setDocumentValidation({ isValid, documentType });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!validateForm()) {
      setError("Por favor, corrija los errores en el formulario.");
      return;
    }

    setLoading(true);
    
    const doc = documentType === 'dni' ? dni : ruc;
    const docType = documentType.toUpperCase();

    const orderData = {
      customer: {
          name: customerName,
          phone: customerPhone,
        document: doc,
        documentType: docType,
      },
      shipping: {
          address: shippingAddress,
        cost: 0, // O el costo de envío calculado
      },
      items: itemsPayload,
      total: total,
      paymentMethod: paymentMethod,
    };

    try {
      if (paymentMethod === 'cash_on_delivery') {
        const response = await apiFetchAuth<{ orderId: string; comprobante?: any; factura?: any }>(`pedidos/contra-entrega`, {
          method: 'POST',
          body: JSON.stringify({
        customerData: {
          name: customerName,
          phone: customerPhone,
              email: customerEmail,
              document: doc,
              documentType: docType.toLowerCase(),
          address: shippingAddress,
            },
            items: itemsPayload,
            total: total,
          }),
        });
        const orderId = response.orderId;
        setResult({ orderId, message: "Pedido registrado. Pagarás al recibir." });
        if (docType === 'RUC' && response.factura) {
          setFacturaDoc(response.factura);
        } else if (docType !== 'RUC' && response.comprobante) {
          setComprobanteDoc(response.comprobante);
        }
      } else if (paymentMethod === 'fake') {
        // Pago ficticio - crea pedido y comprobante automáticamente
        const response = await apiFetchAuth<{ 
          orderId: string; 
          orderNumber: string;
          comprobante?: any;
          factura?: any;
        }>(`pedidos/pago-ficticio`, {
        method: 'POST',
        body: JSON.stringify({
          customerData: {
            name: customerName,
            phone: customerPhone,
              email: customerEmail,
              document: doc,
              documentType: docType.toLowerCase(),
            address: shippingAddress,
          },
            items: itemsPayload,
            total: total,
        }),
      });

        console.log('[Pasarela] 📦 Respuesta completa de pago ficticio:', response);
        
        setResult({ 
          orderId: response.orderId, 
          orderNumber: response.orderNumber,
          message: "Pago ficticio completado exitosamente. Pedido registrado y comprobante generado." 
        });

        // El backend ya genera el comprobante/factura en la respuesta
        if (docType === 'RUC' && response.factura) {
          console.log('[Pasarela] ✅ Factura recibida:', response.factura);
          setFacturaDoc(response.factura);
        } else if (response.comprobante) {
          console.log('[Pasarela] ✅ Comprobante recibido:', response.comprobante);
          setComprobanteDoc(response.comprobante);
        } else {
          console.warn('[Pasarela] ⚠️ No se recibió comprobante/factura en la respuesta');
        }
      }

      setSuccess(true);
      clear(); // Limpiar carrito
      sessionStorage.removeItem("last_order_summary");

    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || "Ocurrió un error desconocido.";
      setError(errorMessage);
      console.error("Error en el proceso de pago:", err);
    } finally {
      setLoading(false);
    }
  };

  const cardDigits = getCardDigits(cardNumber);
  const cardBrand = detectCardBrand(cardDigits);
  const cardLast4 = cardDigits.slice(-4);

  if (!isHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
          <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700">Cargando Carrito...</h2>
          <p className="text-gray-500">Por favor, espere un momento.</p>
        </div>
      </div>
    );
  }

  if (items.length === 0 && !success) {
  return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <ShoppingCart className="w-16 h-16 mx-auto text-gray-400" />
          <h2 className="mt-4 text-2xl font-semibold text-gray-800">Tu carrito está vacío</h2>
          <p className="mt-2 text-gray-600">Añade productos a tu carrito para poder continuar con la compra.</p>
          <button
            onClick={() => router.push('/')}
            className="mt-6 inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <ArrowLeft className="mr-2 -ml-1 h-5 w-5" />
            Volver a la tienda
          </button>
          </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center justify-center">
              <div className={stepCircleClass(1)}>1</div>
            <div className={stepBarClass(1)}></div>
              <div className={stepCircleClass(2)}>2</div>
            <div className={stepBarClass(2)}></div>
              <div className={stepCircleClass(3)}>3</div>
            </div>
        <div className="grid grid-cols-3 mb-2 text-center text-sm font-medium">
          <div className={stepTextClass(1)}>Información</div>
          <div className={stepTextClass(2)}>Pago</div>
          <div className={stepTextClass(3)}>Confirmación</div>
        </div>

        {success ? (
          <div className="bg-white p-8 rounded-lg shadow-lg text-center">
            <CheckCircle className="w-16 h-16 mx-auto text-green-500" />
            <h2 className="mt-4 text-2xl font-semibold text-gray-800">¡Gracias por tu compra!</h2>
            <p className="mt-2 text-gray-600">{result?.message}</p>
            <p className="mt-1 text-sm text-gray-500">Tu número de orden es: #{result?.orderId}</p>
            
            <div className="mt-6 border-t pt-6">
              {facturaDoc && renderComprobante(facturaDoc, "Factura Electrónica")}
              {comprobanteDoc && renderComprobante(comprobanteDoc, "Boleta Electrónica")}
              </div>
                  
                  <button
              onClick={() => router.push('/perfil')}
              className="mt-8 inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Ver mis pedidos
                  </button>
                    </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Columna de Resumen de Orden */}
            <div className="bg-white p-6 rounded-lg shadow-md sticky top-4">
              <h3 className="text-lg font-medium text-gray-900 border-b pb-4 mb-4 flex items-center">
                <ShoppingCart className="w-5 h-5 mr-2 text-gray-600" />
                Resumen de tu Orden
              </h3>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.productId} className="flex items-center space-x-4 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="relative">
                      <img 
                        src={getImageUrl(item.imageUrl || item.thumbnailUrl)} 
                        alt={item.name} 
                        className="w-16 h-16 rounded-md object-cover bg-gray-100 border border-gray-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/vercel.svg';
                        }}
                      />
                      <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
                        {item.quantity}
                </div>
              </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{item.name}</p>
                      <p className="text-sm text-gray-500">Precio unitario: {formatCurrency(item.price)}</p>
            </div>
                    <p className="font-medium text-gray-900 whitespace-nowrap">{formatCurrency(item.price * item.quantity)}</p>
              </div>
                ))}
              </div>
              <div className="border-t mt-6 pt-6 space-y-3">
                <div className="flex justify-between text-gray-600">
                  <span className="flex items-center">
                    <FileText className="w-4 h-4 mr-1" />
                    Subtotal
                  </span>
                  <span className="font-medium">{formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span className="flex items-center">
                    <Truck className="w-4 h-4 mr-1" />
                    Envío
                  </span>
                  <span className="font-medium text-green-600 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Gratis
                  </span>
                </div>
                <div className="flex justify-between text-xl font-bold text-gray-900 pt-3 border-t">
                  <span>Total</span>
                  <span className="text-blue-600">{formatCurrency(total)}</span>
                </div>
                  </div>
                </div>

            {/* Columna de Formulario de Pago */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <form onSubmit={handleSubmit}>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Información del Cliente</h3>
                <p className="text-[11px] text-gray-400 mb-3">build: {PASARELA_BUILD_TAG}</p>
                
                <div className="mb-4">
                  <label htmlFor="document" className="block text-sm font-medium text-gray-700 mb-1">
                    DNI / RUC
                  </label>
                  <DocumentInput
                    value={documentType === 'dni' ? dni : ruc}
                    onChange={handleDocumentChange}
                    onValidationChange={handleValidationChange}
                  />
                  {documentError && <p className="text-red-500 text-xs mt-1">{documentError}</p>}
                  {autoLoading && <p className="text-blue-500 text-xs mt-1">Buscando...</p>}
                  {autoError && <p className="text-red-500 text-xs mt-1">{autoError}</p>}
                </div>

                <div className="mb-4">
                  <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    <User className="w-4 h-4 mr-1" />
                    Nombre Completo / Razón Social
                  </label>
                  <input
                    type="text"
                    id="customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    onBlur={validateName}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  {nameError && <p className="text-red-500 text-xs mt-1">{nameError}</p>}
                </div>

                <div className="mb-4">
                  <label htmlFor="customerPhone" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    Teléfono de Contacto
                  </label>
                  <input
                    type="text"
                    id="customerPhone"
                    value={customerPhone}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={9}
                    minLength={9}
                    placeholder="987654321 (9 dígitos)"
                    onChange={(e) => {
                      const clean = (e.target.value || '').replace(/[^0-9]/g, '').slice(0, 9);
                      setCustomerPhone(clean);
                    }}
                    onKeyDown={(e) => {
                      // Permitir teclas de control/navegación
                      const allowed = [
                        'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End',
                      ];
                      if (allowed.includes(e.key)) return;
                      // Bloquear cualquier tecla no numérica
                      if (!/^[0-9]$/.test(e.key)) e.preventDefault();
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const text = (e.clipboardData?.getData('text') || '').replace(/[^0-9]/g, '').slice(0, 9);
                      setCustomerPhone(text);
                    }}
                    onBlur={validatePhone}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
                </div>

                <div className="mb-4">
                  <label htmlFor="customerEmail" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    <User className="w-4 h-4 mr-1" />
                    Email (para enviar comprobante)
                  </label>
                  <input
                    type="email"
                    id="customerEmail"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    onBlur={validateEmail}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="correo@ejemplo.com"
                    required
                  />
                  {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}
            </div>

                    <div className="mb-4">
                  <label htmlFor="shippingAddress" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    Dirección de Envío
                      </label>
                  <input
                    type="text"
                    id="shippingAddress"
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    onBlur={validateAddress}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  {addressError && <p className="text-red-500 text-xs mt-1">{addressError}</p>}
                    </div>
                    
                <h3 className="text-lg font-medium text-gray-900 my-4 pt-4 border-t">Método de Pago</h3>
                <div className="space-y-3">
                  <div className={`flex items-center p-3 border rounded-md cursor-pointer transition-all ${
                    paymentMethod === 'cash_on_delivery' 
                      ? 'bg-blue-50 border-blue-500 shadow-sm' 
                      : 'border-gray-300 hover:border-blue-300'
                  }`}>
                    <input
                      id="cash_on_delivery"
                      name="paymentMethod"
                      type="radio"
                      value="cash_on_delivery"
                      checked={paymentMethod === 'cash_on_delivery'}
                      onChange={() => setPaymentMethod('cash_on_delivery')}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <label htmlFor="cash_on_delivery" className="ml-3 flex-1 cursor-pointer">
                      <div className="flex items-center">
                        <Truck className="w-5 h-5 text-gray-600 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-700">Pago Contra Entrega</div>
                          <div className="text-xs text-gray-500">Paga cuando recibas tu pedido</div>
                </div>
              </div>
                    </label>
                </div>
                  <div className={`flex items-center p-3 border rounded-md cursor-pointer transition-all ${
                    paymentMethod === 'fake' 
                      ? 'bg-green-50 border-green-500 shadow-sm' 
                      : 'border-gray-300 hover:border-green-300'
                  }`}>
                    <input
                      id="fake"
                      name="paymentMethod"
                      type="radio"
                      value="fake"
                      checked={paymentMethod === 'fake'}
                      onChange={() => setPaymentMethod('fake')}
                      className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"
                    />
                    <label htmlFor="fake" className="ml-3 flex-1 cursor-pointer">
                      <div className="flex items-center">
                        <CheckCircle className="w-5 h-5 text-gray-600 mr-2" />
                      <div>
                          <div className="text-sm font-medium text-gray-700">Pago Ficticio (Pruebas)</div>
                          <div className="text-xs text-gray-500">Simula un pago completado para pruebas</div>
                      </div>
                      </div>
                    </label>
                    </div>
                  </div>

                {paymentMethod === 'fake' && (
                  <div className="mt-4 rounded-md border border-green-200 bg-green-50/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-800">Datos de tarjeta (ficticios)</div>
                        <div className="text-xs text-gray-600">No se realizará ningún cobro real.</div>
                      </div>
                      <div className="text-xs text-gray-500">{cardBrand}{cardLast4 ? ` •••• ${cardLast4}` : ""}</div>
                    </div>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Número de tarjeta</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="cc-number"
                          placeholder="1234 5678 9012 3456"
                          value={cardNumber}
                          onChange={(e) => {
                            const digits = getCardDigits(e.target.value);
                            setCardNumber(formatCardNumber(digits));
                          }}
                          onBlur={validateCardNumber}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                          required
                        />
                        {cardErrors.number && <p className="text-red-500 text-xs mt-1">{cardErrors.number}</p>}
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del titular</label>
                        <input
                          type="text"
                          autoComplete="cc-name"
                          placeholder="NOMBRE APELLIDO"
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          onBlur={validateCardName}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                          required
                        />
                        {cardErrors.name && <p className="text-red-500 text-xs mt-1">{cardErrors.name}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Vencimiento</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="cc-exp"
                          placeholder="MM/YY"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                          onBlur={validateCardExpiry}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                          required
                        />
                        {cardErrors.expiry && <p className="text-red-500 text-xs mt-1">{cardErrors.expiry}</p>}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">CVC</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="cc-csc"
                          placeholder={cardBrand === 'American Express' ? '1234' : '123'}
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          onBlur={validateCardCvc}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                          required
                        />
                        {cardErrors.cvc && <p className="text-red-500 text-xs mt-1">{cardErrors.cvc}</p>}
                      </div>
                    </div>
                  </div>
                )}
                  
                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

                <div className="mt-6">
                    <button
                      type="submit"
                    disabled={loading || !isHydrated}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
                  >
                    {loading ? 'Procesando...' : `Pagar ${formatCurrency(total)}`}
                    </button>
                </div>
                  </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PasarelaPage() {
  return (
      <Suspense fallback={<div>Cargando...</div>}>
        <CheckoutForm />
      </Suspense>
  );
}
