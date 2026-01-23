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
    const doc = documentType === 'dni' ? dni : ruc;
    const cleanDoc = (doc || '').replace(/[^0-9]/g, '');
    setAutoError(null);

    const isValidLength = cleanDoc.length === 8 || cleanDoc.length === 11;

    if (!isValidLength || !cleanDoc) {
      setAutoLoading(false);
      setAutoData(null);
      return;
    }

    if (!documentValidation.isValid) {
      setAutoLoading(false);
      setAutoData(null);
      return;
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
        if (data.type === 'DNI') {
          const name = data.name || data.nombre || 'Cliente';
          console.error('[Pasarela] ✏️ Estableciendo nombre DNI:', name);
          console.log('[Pasarela] ✏️ Estableciendo nombre DNI:', name);
          setCustomerName(name);
        } else if (data.type === 'RUC') {
          const businessName = data.businessName || data.razonSocial || 'Empresa';
          console.error('[Pasarela] ✏️ Estableciendo razón social RUC:', businessName);
          console.log('[Pasarela] ✏️ Estableciendo razón social RUC:', businessName);
          setCustomerName(businessName);
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

  const handleValidationChange = (validation: { isValid: boolean; documentType: 'DNI' | 'RUC' | null }) => {
    setDocumentValidation(validation);
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
      if (paymentMethod === 'card') {
        if (!stripe || !elements) {
          throw new Error("Stripe no está listo.");
        }
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
          throw new Error("Elemento de tarjeta no encontrado.");
        }

        const { error: stripeError, paymentMethod: stripePaymentMethod } = await stripe.createPaymentMethod({
          type: 'card',
          card: cardElement,
          billing_details: {
            name: customerName,
            phone: customerPhone,
          },
        });

        if (stripeError) {
          throw new Error(stripeError.message || "Error al crear método de pago.");
        }

        const { id } = stripePaymentMethod;
        const response = await apiFetchAuth.post(`/checkout/create-payment-intent`, {
          paymentMethodId: id,
          amount: Math.round(total * 100), // En centavos
          customer: orderData.customer,
          shipping: orderData.shipping,
          items: orderData.items,
        });

        const { clientSecret, orderId } = response.data;

        const { error: confirmError } = await stripe.confirmCardPayment(clientSecret);

        if (confirmError) {
          throw new Error(confirmError.message || "Error al confirmar el pago.");
        }
        
        setResult({ orderId, message: "Pago completado con éxito." });

      } else if (paymentMethod === 'cash_on_delivery') {
        const response = await apiFetchAuth.post(`/checkout/cash-order`, orderData);
        setResult({ orderId: response.data.orderId, message: "Pedido registrado. Pagarás al recibir." });
      }
      
      // Generar comprobante
      const comprobanteResponse = await apiFetchAuth.post('/checkout/generate-receipt', {
        orderId: result.orderId,
        documentType: docType === 'RUC' ? 'factura' : 'boleta'
      });

      if (docType === 'RUC') {
        setFacturaDoc(comprobanteResponse.data);
      } else {
        setComprobanteDoc(comprobanteResponse.data);
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
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-medium text-gray-900 border-b pb-4 mb-4">Resumen de tu Orden</h3>
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center space-x-4">
                    <img src={item.image} alt={item.name} className="w-16 h-16 rounded-md object-cover" />
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{item.name}</p>
                      <p className="text-sm text-gray-500">Cantidad: {item.quantity}</p>
                    </div>
                    <p className="font-medium text-gray-900">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
              <div className="border-t mt-6 pt-6 space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Envío</span>
                  <span className="font-medium text-green-600">Gratis</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-gray-900">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {/* Columna de Formulario de Pago */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <form onSubmit={handleSubmit}>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Información del Cliente</h3>
                
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
                  <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">
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
                  <label htmlFor="customerPhone" className="block text-sm font-medium text-gray-700 mb-1">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="tel"
                    id="customerPhone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    onBlur={validatePhone}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
                </div>

                <div className="mb-4">
                  <label htmlFor="shippingAddress" className="block text-sm font-medium text-gray-700 mb-1">
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
                  <div className="flex items-center p-3 border rounded-md has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500">
                    <input
                      id="card"
                      name="paymentMethod"
                      type="radio"
                      value="card"
                      checked={paymentMethod === 'card'}
                      onChange={() => setPaymentMethod('card')}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <label htmlFor="card" className="ml-3 block text-sm font-medium text-gray-700">
                      Tarjeta de Crédito/Débito
                    </label>
                  </div>
                  <div className="flex items-center p-3 border rounded-md has-[:checked]:bg-blue-50 has-[:checked]:border-blue-500">
                    <input
                      id="cash_on_delivery"
                      name="paymentMethod"
                      type="radio"
                      value="cash_on_delivery"
                      checked={paymentMethod === 'cash_on_delivery'}
                      onChange={() => setPaymentMethod('cash_on_delivery')}
                      className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <label htmlFor="cash_on_delivery" className="ml-3 block text-sm font-medium text-gray-700">
                      Pago Contra Entrega
                    </label>
                  </div>
                </div>

                {paymentMethod === 'card' && (
                  <div className="mt-4 p-4 border rounded-lg">
                    <CardElement options={{
                      style: {
                        base: {
                          fontSize: '16px',
                          color: '#424770',
                          '::placeholder': {
                            color: '#aab7c4',
                          },
                        },
                        invalid: {
                          color: '#9e2146',
                        },
                      },
                    }} />
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
  if (!stripePromise) {
    return (
      <div className="text-center py-10">
        <p className="text-red-500">La clave de Stripe no está configurada. El pago no puede continuar.</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <Elements stripe={stripePromise}>
        <CheckoutForm />
      </Elements>
    </Suspense>
  );
}
