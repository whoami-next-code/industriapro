"use client";
import React, { useMemo, useState, useEffect, Suspense } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import axios from "axios";
import { useCart } from "@/components/cart/CartContext";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  CreditCard, 
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
import { apiFetchAuth, requireAuthOrRedirect } from "@/lib/api";

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || "";
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001/api";

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

type PaymentMethod = 'card' | 'cash_on_delivery' | 'fake';

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
  const items = Array.isArray(data.items) ? data.items : [];

  return (
    <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-dashed border-gray-200 pb-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-gray-400">Comprobante electrónico</div>
          <h4 className="text-lg font-semibold text-gray-900">{title}</h4>
          <p className="text-xs text-gray-500">Documento generado automáticamente</p>
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
  const stripe = useStripe();
  const elements = useElements();
  const { items, total, isHydrated, clear } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Estados principales
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [ruc, setRuc] = useState("");
  const [dni, setDni] = useState("");
  const [documentType, setDocumentType] = useState<'dni' | 'ruc'>('dni');
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
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
  const [addressError, setAddressError] = useState("");

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

  const itemsPayload = useMemo(() => items.map(it => ({
    productId: it.productId,
    nombre: it.name,
    precioUnitario: it.price,
    cantidad: it.quantity,
  })), [items]);

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

  const validateAddress = () => {
    if (!shippingAddress.trim() || shippingAddress.trim().length < 10) {
      setAddressError("Dirección debe tener al menos 10 caracteres");
      return false;
    }
    setAddressError("");
    return true;
  };

  const validateForm = () => {
    const isDocumentValid = validateDocument();
    const isNameValid = validateName();
    const isPhoneValid = validatePhone();
    const isAddressValid = validateAddress();
    
    return isDocumentValid && isNameValid && isPhoneValid && isAddressValid;
  };

  // Debounced autocompletado desde API interna protegida
  useEffect(() => {
    // Logging inmediato para verificar que el effect se ejecuta
    console.error('[Pasarela] 🔄 useEffect AUTocomplete EJECUTADO');
    console.log('[Pasarela] 🔄 useEffect AUTocomplete EJECUTADO');
    
    const doc = documentType === 'dni' ? dni : ruc;
    const cleanDoc = (doc || '').replace(/[^0-9]/g, '');
    
    console.error('[Pasarela] ========== AUTocomplete EFFECT ==========');
    console.error('[Pasarela] Estado completo:', JSON.stringify({
      documentType,
      doc,
      cleanDoc,
      cleanDocLength: cleanDoc.length,
      documentValidation,
      isValid: documentValidation.isValid,
      documentTypeDetected: documentValidation.documentType,
    }, null, 2));
    
    console.log('[Pasarela] ========== AUTocomplete EFFECT ==========');
    console.log('[Pasarela] Estado completo:', {
      documentType,
      doc,
      cleanDoc,
      cleanDocLength: cleanDoc.length,
      documentValidation,
      isValid: documentValidation.isValid,
      documentTypeDetected: documentValidation.documentType,
    });
    
    setAutoError(null);
    
    // Validar que el documento tenga la longitud correcta
    const isValidLength = cleanDoc.length === 8 || cleanDoc.length === 11;
    
    if (!isValidLength || !cleanDoc) {
      console.error('[Pasarela] ❌ Autocomplete cancelado - longitud inválida:', {
        cleanDoc,
        cleanDocLength: cleanDoc.length,
        isValidLength,
      });
      console.log('[Pasarela] ❌ Autocomplete cancelado - longitud inválida');
      setAutoLoading(false);
      setAutoData(null);
      return;
    }
    
    // Si el documento no está validado, esperar un poco más
    if (!documentValidation.isValid) {
      console.error('[Pasarela] ⏳ Autocomplete esperando validación...', {
        isValid: documentValidation.isValid,
        documentType: documentValidation.documentType,
      });
      console.log('[Pasarela] ⏳ Autocomplete esperando validación...');
      setAutoLoading(false);
      setAutoData(null);
      return;
    }
    
    console.error('[Pasarela] ✅ Validación pasada, continuando...');
    console.log('[Pasarela] ✅ Validación pasada, continuando...');
    
    // Limpiar caché si los datos son genéricos (para forzar nueva consulta)
    const cached = cacheRef.current.get(cleanDoc);
    if (cached && (cached.name === 'Cliente' || cached.businessName === 'Empresa')) {
      console.log('[Pasarela] Eliminando caché genérico para:', cleanDoc);
      cacheRef.current.delete(cleanDoc);
      try { sessionStorage.removeItem(`doc_cache_${cleanDoc}`); } catch {}
    }
    
    // Verificar caché en sessionStorage también
    let sessionCached = null;
    try {
      const cachedStr = sessionStorage.getItem(`doc_cache_${cleanDoc}`);
      if (cachedStr) {
        sessionCached = JSON.parse(cachedStr);
        console.log('[Pasarela] Datos encontrados en sessionStorage:', sessionCached);
      }
    } catch (e) {
      console.warn('[Pasarela] Error leyendo sessionStorage:', e);
    }
    
    const finalCached = cacheRef.current.get(cleanDoc) || sessionCached;
    if (finalCached && finalCached.ok && finalCached.name !== 'Cliente' && finalCached.businessName !== 'Empresa') {
      console.log('[Pasarela] Usando datos en caché válidos para:', cleanDoc, finalCached);
      setAutoData(finalCached);
      if (finalCached.type === 'DNI') {
        setCustomerName(finalCached.name || 'Cliente');
        if (!shippingAddress && finalCached.address) setShippingAddress(finalCached.address);
      } else if (finalCached.type === 'RUC') {
        setCustomerName(finalCached.businessName || 'Empresa');
        if (!shippingAddress && finalCached.address) setShippingAddress(finalCached.address);
      }
      return;
    }
    
    // FORZAR consulta al backend (eliminar cualquier caché genérico)
    console.log('[Pasarela] ✅ FORZANDO consulta de autocomplete para:', cleanDoc);
    console.log('[Pasarela] Estado antes de consulta:', {
      cleanDoc,
      isValid: documentValidation.isValid,
      documentType: documentValidation.documentType,
      hasCached: !!finalCached,
    });
    
    setAutoLoading(true);
    const t = setTimeout(async () => {
      try {
        const url = `/api/clientes/autocomplete?doc=${encodeURIComponent(cleanDoc)}`;
        console.log('[Pasarela] 🌐 Llamando a:', url);
        console.error('[Pasarela] 🌐 Llamando a:', url); // También en console.error para Railway
        
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        console.log('[Pasarela] 📥 Respuesta recibida - status:', res.status, res.statusText);
        console.error('[Pasarela] 📥 Respuesta recibida - status:', res.status, res.statusText);
        
        if (!res.ok) {
          const text = await res.text();
          console.error('[Pasarela] ❌ Error en respuesta:', text);
          throw new Error(text || 'Error al consultar documento');
        }
        const data = await res.json();
        console.log('[Pasarela] 📦 Datos recibidos de autocomplete:', JSON.stringify(data, null, 2));
        console.error('[Pasarela] 📦 Datos recibidos:', JSON.stringify(data, null, 2));
        
        // Cachear siempre (incluso si son genéricos, para evitar llamadas repetidas)
        cacheRef.current.set(cleanDoc, data);
        try { sessionStorage.setItem(`doc_cache_${cleanDoc}`, JSON.stringify(data)); } catch {}
        
        setAutoData(data);
        if (data.type === 'DNI') {
          const name = data.name || data.nombre || 'Cliente';
          console.log('[Pasarela] ✏️ Estableciendo nombre DNI:', name);
          setCustomerName(name);
          if (!shippingAddress && data.address) setShippingAddress(data.address);
        } else if (data.type === 'RUC') {
          const businessName = data.businessName || data.razonSocial || data.razon_social || 'Empresa';
          console.log('[Pasarela] ✏️ Estableciendo razón social RUC:', businessName);
          setCustomerName(businessName);
          if (!shippingAddress && data.address) setShippingAddress(data.address);
        }
        setAutoError(null);
      } catch (e: any) {
        console.error('[Pasarela] ❌ Error en autocomplete:', e);
        setAutoError(e?.message || 'No se pudo obtener datos');
      } finally {
        setAutoLoading(false);
      }
    }, 300); // Reducir delay
    return () => clearTimeout(t);
  }, [documentType, dni, ruc, documentValidation.isValid, documentValidation.documentType, shippingAddress]);

  // Pago con tarjeta
  async function handleCardPayment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    
    if (!isHydrated) { 
      setError("El carrito se está cargando, intenta de nuevo."); 
      return; 
    }
    
    if (!stripe || !elements) { 
      setError("Stripe no está listo."); 
      return; 
    }
    
    if (items.length === 0) { 
      setError("Tu carrito está vacío."); 
      return; 
    }

    if (!validateForm()) {
      setError("Por favor corrige los errores en el formulario");
      return;
    }

    setLoading(true);
    
    try {
      // 1) Crear intento de pago en backend
      const document = documentType === 'dni' ? dni : ruc;
      const resp = await axios.post(`${API_BASE}/pagos/intento`, { 
        ruc: document, 
        items: itemsPayload,
        customerData: {
          name: customerName,
          phone: customerPhone,
          address: shippingAddress,
          documentType,
          document
        }
      });
      
      const data = resp.data;
      if (!data?.ok) { 
        throw new Error(data?.error || "No se pudo iniciar el pago"); 
      }
      
      setFacturaDoc(data.factura);

      // 2) Confirmar el pago con Stripe Elements
      const card = elements.getElement(CardElement);
      if (!card) throw new Error("No se encontró el elemento de tarjeta");

      const { error: stripeErr, paymentIntent } = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: { card },
      });

      if (stripeErr) throw stripeErr;
      
      setResult(paymentIntent);
      setSuccess(true);
      clear();
      
      // Redirigir a página de confirmación después de 3 segundos
      setTimeout(() => {
        router.push(`/confirmacion?paymentId=${paymentIntent.id}&method=card`);
      }, 3000);
      
    } catch (err: any) {
      setError(err?.message || "Error realizando el pago");
    } finally {
      setLoading(false);
    }
  }

  // Pago contra entrega
  async function handleCashOnDelivery(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    
    if (items.length === 0) { 
      setError("Tu carrito está vacío."); 
      return; 
    }

    if (!validateForm()) {
      setError("Por favor corrige los errores en el formulario");
      return;
    }

    setLoading(true);
    
    try {
      // Crear pedido con pago contra entrega
      const document = documentType === 'dni' ? dni : ruc;
      const resp = await axios.post(`${API_BASE}/pedidos/contra-entrega`, {
        items: itemsPayload,
        customerData: {
          name: customerName,
          phone: customerPhone,
          address: shippingAddress,
          documentType,
          document
        },
        total: total
      });
      
      const data = resp.data;
      if (!data?.ok) { 
        throw new Error(data?.error || "No se pudo crear el pedido"); 
      }
      
      setSuccess(true);
      clear();
      
      // Redirigir a página de confirmación
      setTimeout(() => {
        router.push(`/confirmacion?orderId=${data.orderId}&method=cash_on_delivery`);
      }, 3000);
      
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Error creando el pedido");
    } finally {
      setLoading(false);
    }
  }

  async function handleFakePayment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFacturaDoc(null);
    setComprobanteDoc(null);

    if (items.length === 0) {
      setError("Tu carrito está vacío.");
      return;
    }
    if (!validateForm()) {
      setError("Por favor corrige los errores en el formulario");
      return;
    }

    const token = requireAuthOrRedirect('/pasarela');
    if (!token) return;

    setLoading(true);
    try {
      const document = documentType === 'dni' ? dni : ruc;
      const response: any = await apiFetchAuth('/pedidos/pago-ficticio', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((it) => ({
            productId: it.productId,
            name: it.name,
            price: it.price,
            quantity: it.quantity,
          })),
          customerData: {
            name: customerName,
            phone: customerPhone,
            address: shippingAddress,
            documentType,
            document,
          },
          total,
        }),
      });

      setComprobanteDoc(response?.comprobante || null);
      setFacturaDoc(response?.factura || null);
      setResult({ status: 'succeeded', id: response?.paymentId || response?.orderNumber });
      clear();
    } catch (err: any) {
      setError(err?.message || "No se pudo registrar el pago ficticio");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {paymentMethod === 'card' ? '¡Pago Exitoso!' : '¡Pedido Confirmado!'}
            </h2>
            <p className="text-gray-600 mb-4">
              {paymentMethod === 'card' 
                ? 'Tu pago ha sido procesado correctamente.'
                : 'Tu pedido ha sido registrado. Pagarás al recibir el producto.'
              }
            </p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Redirigiendo...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al carrito
          </button>
          
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-6 w-6 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Finalizar Compra</h1>
          </div>
          
          {/* Indicadores de progreso */}
          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className="flex items-center">
              <div className={stepCircleClass(1)}>1</div>
              <span className={`ml-2 text-sm font-medium ${stepTextClass(1)}`}>Datos</span>
            </div>
            <div className={stepBarClass(1)}></div>
            <div className="flex items-center">
              <div className={stepCircleClass(2)}>2</div>
              <span className={`ml-2 text-sm font-medium ${stepTextClass(2)}`}>Pago</span>
            </div>
            <div className={stepBarClass(2)}></div>
            <div className="flex items-center">
              <div className={stepCircleClass(3)}>3</div>
              <span className={`ml-2 text-sm font-medium ${stepTextClass(3)}`}>Confirmación</span>
            </div>
          </div>
        </div>

        {/* Mensaje de error */}
        {error && (
          <div className="mb-6 p-4 rounded-lg border-l-4 bg-red-50 border-red-400 text-red-700">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              <p className="font-medium">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Columna principal - Formulario */}
          <div className="lg:col-span-2 space-y-6">
            {/* Selección de método de pago */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Método de Pago</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      paymentMethod === 'card'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-center mb-2">
                      <CreditCard className="h-8 w-8 text-blue-600" />
                    </div>
                    <h4 className="font-medium text-gray-900">Tarjeta de Crédito/Débito</h4>
                    <p className="text-sm text-gray-600 mt-1">Pago inmediato y seguro</p>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash_on_delivery')}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      paymentMethod === 'cash_on_delivery'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-center mb-2">
                      <Truck className="h-8 w-8 text-green-600" />
                    </div>
                    <h4 className="font-medium text-gray-900">Contra Entrega</h4>
                    <p className="text-sm text-gray-600 mt-1">Paga al recibir el producto</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('fake')}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      paymentMethod === 'fake'
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-center mb-2">
                      <FileText className="h-8 w-8 text-amber-600" />
                    </div>
                    <h4 className="font-medium text-gray-900">Pago Ficticio</h4>
                    <p className="text-sm text-gray-600 mt-1">Solo para pruebas</p>
                  </button>
                </div>
              </div>
            </div>

            {/* Información del cliente */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <User className="h-5 w-5 mr-2 text-blue-600" />
                  Información del Cliente
                </h3>
              </div>
              <div className="p-6 space-y-4">
                {/* Tipo de documento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Documento *
                  </label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="dni"
                        checked={documentType === 'dni'}
                        onChange={(e) => setDocumentType(e.target.value as 'dni' | 'ruc')}
                        className="mr-2"
                      />
                      DNI (Persona Natural)
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="ruc"
                        checked={documentType === 'ruc'}
                        onChange={(e) => setDocumentType(e.target.value as 'dni' | 'ruc')}
                        className="mr-2"
                      />
                      RUC (Empresa)
                    </label>
                  </div>
                </div>

                {/* Documento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {documentType === 'dni' ? 'DNI *' : 'RUC *'}
                  </label>
                  <DocumentInput
                    value={documentType === 'dni' ? dni : ruc}
                    onChange={(val) => {
                      if (documentType === 'dni') {
                        setDni(val);
                      } else {
                        setRuc(val);
                      }
                      if (documentError) validateDocument();
                    }}
                    onValidationChange={(isValid, detectedType) => {
                      setDocumentValidation({ isValid, documentType: detectedType });
                      // Ajustar automáticamente solo hacia RUC para evitar saltos molestos a DNI
                      if (detectedType === 'RUC' && documentType !== 'ruc') {
                        setDocumentType('ruc');
                      }
                      // Actualizar mensaje de error en vivo
                      if (!isValid) {
                        const msg = detectedType === 'DNI'
                          ? 'DNI inválido'
                          : detectedType === 'RUC'
                            ? 'RUC inválido'
                            : 'Documento inválido';
                        setDocumentError(msg);
                      } else {
                        setDocumentError('');
                      }
                    }}
                    placeholder={documentType === 'dni' ? '12345678' : '20123456789'}
                  />
                  {documentError && (
                    <p className="mt-1 text-sm text-red-600">{documentError}</p>
                  )}
                  {/* Estado de autocompletado */}
                  <div className="mt-2 text-sm flex items-center gap-2">
                    {autoLoading && (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                        <span className="text-gray-600">Consultando registros…</span>
                      </>
                    )}
                    {!autoLoading && autoError && (
                      <>
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <span className="text-red-600">{autoError}</span>
                      </>
                    )}
                    {!autoLoading && autoData && (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-green-700">Datos encontrados</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Nombre / Razón Social (autocompletado inteligente) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {documentType === 'dni' ? 'Nombres completos *' : 'Razón social *'}
                  </label>
                  <OwnerAutocomplete
                    documentType={documentType}
                    documentNumber={documentType === 'dni' ? dni : ruc}
                    value={customerName}
                    onChange={(v) => {
                      setCustomerName(v);
                      if (nameError) validateName();
                    }}
                    onSelect={(owner) => {
                      setCustomerName(owner.name || '');
                      if (owner.address && !shippingAddress) setShippingAddress(owner.address);
                      if (owner.phone && !customerPhone) setCustomerPhone(owner.phone);
                      // Revalidar
                      validateName();
                    }}
                    placeholder={documentType === 'dni' ? 'Juan Pérez García' : 'Industrias S.A.C.'}
                  />
                  {nameError && (
                    <p className="mt-1 text-sm text-red-600">{nameError}</p>
                  )}
                </div>

                {/* Información autocompletada de solo lectura (solo RUC) */}
                {autoData?.type === 'RUC' && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Dirección fiscal</label>
                      <input readOnly value={autoData.address || ''} className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 border-gray-200" placeholder="No disponible" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Estado del contribuyente</label>
                      <input readOnly value={autoData.status || ''} className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 border-gray-200" placeholder="No disponible" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Actividad económica</label>
                      <input readOnly value={autoData.activity || ''} className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 border-gray-200" placeholder="No disponible" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Representantes legales</label>
                      <textarea 
                        readOnly 
                        value={
                          (autoData.legalRepresentatives && autoData.legalRepresentatives.length > 0)
                            ? autoData.legalRepresentatives.map((r: any) => {
                                if (typeof r === 'string') return r;
                                const nombre = r?.nombre || r?.name || '';
                                const documento = r?.documento || r?.document || r?.dni || '';
                                const cargo = r?.cargo || r?.position || '';
                                const parts = [nombre, documento ? `(${documento})` : '', cargo ? `- ${cargo}` : ''].filter(Boolean);
                                return parts.join(' ');
                              }).join('\n')
                            : 'No disponible'
                        } 
                        rows={3} 
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 border-gray-200" 
                        placeholder="No disponible" 
                      />
                    </div>
                  </div>
                )}

                {/* Teléfono */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teléfono *
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => {
                      setCustomerPhone(e.target.value);
                      if (phoneError) validatePhone();
                    }}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      phoneError ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="987654321"
                    required
                  />
                  {phoneError && (
                    <p className="mt-1 text-sm text-red-600">{phoneError}</p>
                  )}
                </div>

                {/* Dirección */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="h-4 w-4 inline mr-1" />
                    Dirección de Entrega *
                  </label>
                  <textarea
                    value={shippingAddress}
                    onChange={(e) => {
                      setShippingAddress(e.target.value);
                      if (addressError) validateAddress();
                    }}
                    rows={3}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      addressError ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Av. Principal 123, Distrito, Provincia, Departamento"
                    required
                  />
                  {addressError && (
                    <p className="mt-1 text-sm text-red-600">{addressError}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Formulario de pago específico */}
            {paymentMethod === 'card' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <CreditCard className="h-5 w-5 mr-2 text-blue-600" />
                    Datos de la Tarjeta
                  </h3>
                </div>
                <div className="p-6">
                  <form onSubmit={handleCardPayment}>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Información de la Tarjeta *
                      </label>
                      <div className="border rounded-lg p-3 bg-gray-50">
                        <CardElement 
                          options={{ 
                            style: { 
                              base: { 
                                fontSize: '16px',
                                color: '#374151',
                                '::placeholder': {
                                  color: '#9CA3AF',
                                },
                              } 
                            } 
                          }} 
                        />
                      </div>
                    </div>
                    
                    <button
                      type="submit"
                      disabled={loading || !stripe || !elements}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Procesando Pago...
                        </>
                      ) : (
                        <>
                          <Shield className="h-4 w-4 mr-2" />
                          Pagar ${total.toFixed(2)}
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {paymentMethod === 'cash_on_delivery' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <Truck className="h-5 w-5 mr-2 text-green-600" />
                    Pago Contra Entrega
                  </h3>
                </div>
                <div className="p-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start">
                      <Clock className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
                      <div>
                        <h4 className="font-medium text-green-800">Información Importante</h4>
                        <ul className="text-sm text-green-700 mt-2 space-y-1">
                          <li>• Pagarás en efectivo al recibir tu pedido</li>
                          <li>• El delivery te contactará antes de la entrega</li>
                          <li>• Tiempo de entrega: 2-5 días hábiles</li>
                          <li>• Ten el monto exacto preparado: ${total.toFixed(2)}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  
                  <form onSubmit={handleCashOnDelivery}>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Confirmando Pedido...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Confirmar Pedido (Pago Contra Entrega)
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {paymentMethod === 'fake' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-amber-600" />
                    Pago Ficticio (Pruebas)
                  </h3>
                </div>
                <div className="p-6">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-sm text-amber-800">
                    Este método genera un comprobante o factura de prueba y registra la venta en el admin.
                  </div>
                  <form onSubmit={handleFakePayment}>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Generando comprobante...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Confirmar pago ficticio
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Resumen */}
          <div className="space-y-6">
            {/* Resumen del pedido */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Resumen del Pedido</h3>
              </div>
              <div className="p-6">
                {items.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No tienes productos en el carrito</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <ul className="space-y-3">
                      {items.map(item => (
                        <li key={item.productId} className="flex items-center justify-between text-sm">
                          <div className="flex-1">
                            <span className="font-medium text-gray-900 block" title={item.name}>
                              {item.name}
                            </span>
                            <span className="text-gray-500">Cantidad: {item.quantity}</span>
                          </div>
                          <span className="font-medium text-gray-900">
                            ${(item.price * item.quantity).toFixed(2)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    
                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-medium">${total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Envío:</span>
                        <span className="font-medium text-green-600">Gratis</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold text-gray-900 border-t pt-2">
                        <span>Total:</span>
                        <span className="text-blue-600">${total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Elementos de confianza */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                <Shield className="h-4 w-4 mr-2 text-green-600" />
                Compra Segura
              </h4>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span>Transacciones encriptadas</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span>Datos protegidos</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span>Garantía de entrega</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span>Soporte 24/7</span>
                </div>
              </div>
            </div>

            {/* Información de entrega */}
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
              <h4 className="text-sm font-semibold text-blue-900 mb-4 flex items-center">
                <Truck className="h-4 w-4 mr-2" />
                Información de Entrega
              </h4>
              <div className="space-y-2 text-sm text-blue-800">
                <p>• Entrega gratuita en toda Lima</p>
                <p>• Tiempo estimado: 2-5 días hábiles</p>
                <p>• Seguimiento en tiempo real</p>
                <p>• Horario: Lunes a Sábado 9am-6pm</p>
              </div>
            </div>
          </div>
        </div>

        {/* Factura preliminar */}
        {(facturaDoc || comprobanteDoc) && (
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-blue-600" />
                Documento Generado
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-6">
                {comprobanteDoc && renderComprobante(comprobanteDoc, "Comprobante")}
                {facturaDoc && renderComprobante(facturaDoc, "Factura")}
              </div>
            </div>
          </div>
        )}

        {/* Resultado del pago */}
        {result?.status === 'succeeded' && (
          <div className="mt-8 bg-green-50 border border-green-200 rounded-xl p-6">
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-green-800">Pago Confirmado</h3>
                <p className="text-sm text-green-700">ID de transacción: {result.id}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Elements stripe={stripePromise || undefined}>
      <Suspense fallback={<div>Cargando...</div>}>
        <CheckoutForm />
      </Suspense>
    </Elements>
  );
}
