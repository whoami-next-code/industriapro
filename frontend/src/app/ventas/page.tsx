"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { useCart } from "@/components/cart/CartContext";
import { apiFetchAuth, requireAuthOrRedirect, getToken, API_URL } from "@/lib/api";
import { useRouter } from "next/navigation";
import CartView from "@/components/cart/CartView";
import DocumentInput from "@/components/DocumentInput";
import { ShoppingCart, CreditCard, Truck, Shield, CheckCircle, AlertCircle, MapPin, User } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || "");
const ENABLE_FAKE_PAYMENT = process.env.NEXT_PUBLIC_ENABLE_FAKE_PAYMENT === 'true';

function VentasPage() {
  const { items, total, clear, removeItem } = useCart();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [valid, setValid] = useState<boolean>(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dni, setDni] = useState<string>("");
  const [docValid, setDocValid] = useState<boolean>(false);
  const [docType, setDocType] = useState<'DNI' | 'RUC' | null>(null);
  const [customerName, setCustomerName] = useState<string>("");
  const [shippingAddress, setShippingAddress] = useState<string>("");
  const [addressError, setAddressError] = useState<string>("");
  const [dniError, setDniError] = useState<string>("");
  const [resultadoCompra, setResultadoCompra] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState<'cart' | 'checkout' | 'payment'>('cart');
  const router = useRouter();
  const API_BASE = API_URL;
  const stripe = useStripe();
  const elements = useElements();

  // Redirigir esta ruta a /pasarela para unificar el flujo
  useEffect(() => {
    try {
      router.replace('/pasarela');
    } catch {}
  }, []);

  // Función para mostrar mensajes con tipo
  const showMessage = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(null), 5000);
  };

  // Validación de DNI
  const validateDni = (value: string) => {
    if (!value) {
      setDniError("El DNI es obligatorio");
      return false;
    }
    if (value.length !== 8 || !/^\d+$/.test(value)) {
      setDniError("El DNI debe tener 8 dígitos");
      return false;
    }
    setDniError("");
    return true;
  };

  // Validación de dirección
  const validateAddress = (value: string) => {
    if (!value || value.trim().length < 10) {
      setAddressError("La dirección debe tener al menos 10 caracteres");
      return false;
    }
    setAddressError("");
    return true;
  };

  // Redirección proactiva al cargar la página si no hay sesión.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      requireAuthOrRedirect();
    }
    // Restaurar selección y dirección desde sessionStorage si existieran
    try {
      const savedSel = sessionStorage.getItem('selected_cart_ids');
      if (savedSel) {
        const arr = JSON.parse(savedSel);
        if (Array.isArray(arr)) setSelectedIds(arr.filter((x: any) => Number.isFinite(Number(x))).map((x: any) => Number(x)));
      }
      const savedAddr = sessionStorage.getItem('shipping_address');
      if (savedAddr) setShippingAddress(savedAddr);
    } catch {}
  }, []);

  async function checkout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    
    // Validaciones previas
    if (!items.length) {
      showMessage("Tu carrito está vacío", 'error');
      return;
    }
    
    if (selectedIds.length === 0) {
      showMessage("Selecciona al menos un producto para continuar", 'error');
      return;
    }
    
    if (!valid) {
      showMessage("Algunos productos seleccionados no tienen stock suficiente", 'error');
      return;
    }

    if (!validateAddress(shippingAddress)) {
      return;
    }
    
    // Verificar sesión
    const token = requireAuthOrRedirect();
    if (!token) return;
    
    setLoading(true);
    setMessage(null);
    
    try {
      const selectedItems = items.filter(i => selectedIds.includes(i.productId));
      const calculatedTotal = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      const payload = {
        items: selectedItems.map((i) => ({ 
          productId: i.productId, 
          name: i.name, 
          price: i.price, 
          quantity: i.quantity 
        })),
        total: Number(calculatedTotal.toFixed(2)),
        shippingAddress: shippingAddress.trim(),
      };
      
      const created: { id?: number } = await apiFetchAuth("/pedidos", { method: "POST", body: JSON.stringify(payload) });
      
      // Redirigir a pasarela de pago con datos necesarios
      const orderId = created?.id;
      const amount = payload.total;
      const count = selectedIds.length;
      
      // Mantener selección en storage temporal
      sessionStorage.setItem("last_order_summary", JSON.stringify({ 
        orderId, 
        amount, 
        items: payload.items, 
        shippingAddress: payload.shippingAddress 
      }));
      
      showMessage("Pedido creado. Completa los datos de tarjeta en el bloque de Pago (Sandbox) para finalizar.", 'success');
      
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || "No se pudo crear el pedido. Intente nuevamente.";
      showMessage(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }

  // Pago con tarjeta (sandbox usando Stripe test)
  async function pagarTarjetaSandbox(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setResultadoCompra(null);

    // Validaciones mínimas, no intrusivas
    if (!items.length || selectedIds.length === 0) {
      showMessage("Selecciona al menos un producto", 'error');
      return;
    }
    if (!docValid) {
      showMessage("Ingresa un DNI o RUC válido", 'error');
      return;
    }
    if (!validateAddress(shippingAddress)) {
      return;
    }
    if (!stripe || !elements) {
      showMessage("Stripe no está listo. Refresca la página.", 'error');
      return;
    }

    setLoading(true);
    try {
      const selectedItems = items.filter(i => selectedIds.includes(i.productId));
      const itemsPayload = selectedItems.map(i => ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity }));
      const resp = await axios.post(`${API_BASE}/pagos/intento`, {
        ruc: dni.trim(),
        items: itemsPayload,
        customerData: {
          name: customerName,
          address: shippingAddress,
          documentType: (docType ? docType.toLowerCase() : 'dni'),
          document: dni.trim(),
        }
      });
      const data = resp.data;
      if (!data?.ok) throw new Error(data?.error || 'No se pudo iniciar el pago');

      const card = elements.getElement(CardElement);
      if (!card) throw new Error('No se encontró el elemento de tarjeta');

      const { error: stripeErr, paymentIntent } = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: { card },
      });

      if (stripeErr) throw new Error(stripeErr.message);
      if (paymentIntent?.status !== 'succeeded') throw new Error('El pago no se confirmó');

      showMessage('Pago realizado en sandbox. ¡Gracias por tu compra!', 'success');
      setResultadoCompra({ status: 'succeeded', id: paymentIntent.id });

      // Opcional: redirigir a confirmación
      // router.push(`/confirmacion?paymentId=${paymentIntent.id}&method=card`);
    } catch (err: any) {
      showMessage(err?.message || 'No se pudo procesar el pago', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Autocompletado de datos del cliente al validar documento
  useEffect(() => {
    async function fetchCustomer() {
      if (!docValid || !dni) return;
      try {
        const res = await fetch(`/api/clientes/autocomplete?doc=${encodeURIComponent(dni)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.type === 'DNI') {
          setCustomerName(data.name || 'Cliente');
          if (!shippingAddress) setShippingAddress(data.address || '');
        } else if (data.type === 'RUC') {
          setCustomerName(data.businessName || 'Empresa');
          if (!shippingAddress) setShippingAddress(data.address || '');
        }
      } catch {}
    }
    fetchCustomer();
  }, [docValid, dni, shippingAddress]);

  // Persistir selección y dirección en sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem('selected_cart_ids', JSON.stringify(selectedIds));
    } catch {}
  }, [selectedIds]);

  useEffect(() => {
    try {
      sessionStorage.setItem('shipping_address', shippingAddress);
    } catch {}
  }, [shippingAddress]);

  async function pagarFicticio(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setResultadoCompra(null);
    
    // Validaciones
    if (!items.length || selectedIds.length === 0) {
      showMessage("Selecciona al menos un producto", 'error');
      return;
    }
    // Para modo prueba aceptamos DNI o RUC válidos (según DocumentInput)
    if (!docValid) {
      showMessage("Ingresa un DNI o RUC válido", 'error');
      return;
    }
    
    setLoading(true);
    
    try {
      const selectedItems = items.filter(i => selectedIds.includes(i.productId));
      const payload = {
        documento: dni.trim(),
        items: selectedItems.map(i => ({ 
          producto: i.name, 
          cantidad: i.quantity, 
          precioUnitario: i.price 
        })),
      };
      
      const endpoint = `${API_BASE}/compras/multiples`;
      const { data } = await axios.post(endpoint, payload, { withCredentials: true });
      setResultadoCompra(data);
      showMessage("Pago ficticio realizado exitosamente. Boleta y comprobante generados.", 'success');
      
      // Limpiar productos seleccionados del carrito después del pago exitoso
      selectedIds.forEach(id => {
        const item = items.find(i => i.productId === id);
        if (item) {
          // Aquí podrías llamar a una función del contexto para remover items
        }
      });
      
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.message;
      const details = status ? ` (HTTP ${status})` : '';
      showMessage(`Error al llamar a /compras/multiples${details}: ${msg || 'No se pudo procesar el pago ficticio'}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  // Pago contra entrega
  async function pagarContraEntrega(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setResultadoCompra(null);

    // Validaciones mínimas
    if (!items.length || selectedIds.length === 0) {
      showMessage("Selecciona al menos un producto", 'error');
      return;
    }
    if (!docValid) {
      showMessage("Ingresa un DNI o RUC válido", 'error');
      return;
    }
    if (!validateAddress(shippingAddress)) {
      return;
    }

    setLoading(true);
    try {
      const selectedItems = items.filter(i => selectedIds.includes(i.productId));
      const subtotal = selectedItems.reduce((sum, it) => sum + it.price * it.quantity, 0);
      const shipping = 0;
      const totalToPay = subtotal + shipping;

      const body = {
        customerName,
        customerDni: dni.trim(),
        customerEmail: '',
        customerPhone: '',
        shippingAddress: shippingAddress.trim(),
        items: selectedItems.map(i => ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity })),
        subtotal: Number(subtotal.toFixed(2)),
        shipping,
        total: Number(totalToPay.toFixed(2)),
        notes: 'Pago contra entrega',
      };

      const endpoint = `${API_BASE}/pedidos/contra-entrega`;
      const resp = await axios.post(endpoint, body, { withCredentials: true });
      const data = resp.data;
      if (!data?.ok) throw new Error(data?.error || 'No se pudo crear el pedido');

      showMessage('Pedido creado con pago contra entrega. Redirigiendo a Mis Pedidos…', 'success');

      // Remover items seleccionados del carrito
      try {
        selectedIds.forEach(id => removeItem(id));
      } catch {}

      // Guardar resumen y redirigir
      sessionStorage.setItem('last_order_summary', JSON.stringify({
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        total: body.total,
        items: body.items
      }));
      setTimeout(() => router.push('/mis-pedidos'), 1200);
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.message;
      const details = status ? ` (HTTP ${status})` : '';
      showMessage(`Error al crear pedido contra entrega${details}: ${msg || 'Intenta nuevamente'}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  // Calcular total de productos seleccionados
  const selectedTotal = items
    .filter(item => selectedIds.includes(item.productId))
    .reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header con indicadores de progreso */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="h-6 w-6 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Mi Carrito de Compras</h1>
          </div>
          
          {/* Indicadores de progreso */}
          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full text-sm font-medium">
                1
              </div>
              <span className="ml-2 text-sm font-medium text-blue-600">Carrito</span>
            </div>
            <div className="w-16 h-0.5 bg-gray-300"></div>
            <div className="flex items-center">
              <div className="flex items-center justify-center w-8 h-8 bg-gray-300 text-gray-500 rounded-full text-sm font-medium">
                2
              </div>
              <span className="ml-2 text-sm font-medium text-gray-500">Pago</span>
            </div>
            <div className="w-16 h-0.5 bg-gray-300"></div>
            <div className="flex items-center">
              <div className="flex items-center justify-center w-8 h-8 bg-gray-300 text-gray-500 rounded-full text-sm font-medium">
                3
              </div>
              <span className="ml-2 text-sm font-medium text-gray-500">Confirmación</span>
            </div>
          </div>
        </div>

        {/* Mensaje de estado */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg border-l-4 ${
            messageType === 'success' ? 'bg-green-50 border-green-400 text-green-700' :
            messageType === 'error' ? 'bg-red-50 border-red-400 text-red-700' :
            'bg-blue-50 border-blue-400 text-blue-700'
          }`}>
            <div className="flex items-center">
              {messageType === 'success' ? <CheckCircle className="h-5 w-5 mr-2" /> :
               messageType === 'error' ? <AlertCircle className="h-5 w-5 mr-2" /> :
               <AlertCircle className="h-5 w-5 mr-2" />}
              <p className="font-medium">{message}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Columna principal - Productos */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Productos en tu carrito ({items.length})
                </h2>
              </div>
              <div className="p-6">
                <CartView
                  onValidate={(ok) => setValid(ok)}
                  onSelectionChange={(ids) => setSelectedIds(ids)}
                  onRemoveFeedback={(name) => showMessage(`Se eliminó "${name}" del carrito`, 'info')}
                  onQuantityFeedback={(name) => showMessage(`Cantidad actualizada para "${name}"`, 'info')}
                />
              </div>
            </div>
          </div>

          {/* Sidebar - Resumen y checkout */}
          <div className="space-y-6">
            {/* Resumen del pedido */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Resumen del Pedido</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Productos seleccionados:</span>
                  <span className="font-medium">{selectedIds.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">${selectedTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Envío:</span>
                  <span className="font-medium text-green-600">Gratis</span>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold text-gray-900">Total:</span>
                    <span className="text-lg font-bold text-blue-600">${selectedTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Formulario de checkout */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Truck className="h-5 w-5 mr-2 text-blue-600" />
                  Información de Envío
                </h3>
              </div>
              <div className="p-6">
                <form onSubmit={checkout} className="space-y-4">
                  {/* Documento del cliente con autocompletado */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <User className="h-4 w-4 inline mr-1" />
                      DNI o RUC
                    </label>
                    <DocumentInput
                      value={dni}
                      onChange={(v) => setDni(v)}
                      onValidationChange={(isValid, type) => { setDocValid(isValid); setDocType(type); }}
                      placeholder="Ingrese DNI (8) o RUC (11)"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nombre / Razón Social</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300"
                      placeholder="Se autocompletará al validar el documento"
                    />
                  </div>
                  <div>
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                      <MapPin className="h-4 w-4 inline mr-1" />
                      Dirección de envío *
                    </label>
                    <textarea
                      id="address"
                      value={shippingAddress}
                      onChange={(e) => {
                        setShippingAddress(e.target.value);
                        if (addressError) validateAddress(e.target.value);
                      }}
                      rows={3}
                      className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        addressError ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Ingresa tu dirección completa de envío..."
                      required
                    />
                    {addressError && (
                      <p className="mt-1 text-sm text-red-600">{addressError}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={!items.length || loading || !valid || selectedIds.length === 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Procesando...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Proceder al Pago ({selectedIds.length} productos)
                      </>
                    )}
                  </button>

                  {!valid && (
                    <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                      <AlertCircle className="h-4 w-4 inline mr-1" />
                      Corrige los productos sin stock antes de continuar.
                    </div>
                  )}
                </form>
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
                  <span>Pago 100% seguro</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span>Envío gratuito</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span>Garantía de calidad</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  <span>Soporte 24/7</span>
                </div>
              </div>
            </div>

            {/* Pago con tarjeta - Sandbox */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <CreditCard className="h-5 w-5 mr-2 text-blue-600" />
                  Pago con Tarjeta (Sandbox)
                </h3>
              </div>
              <div className="p-6">
                <form onSubmit={pagarTarjetaSandbox} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Datos de la tarjeta</label>
                    <div className="border rounded-lg px-3 py-2 text-sm">
                      <CardElement options={{ hidePostalCode: true }} />
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Usa tarjetas de prueba: 4242 4242 4242 4242, 12/34, CVC 123.</p>
                  </div>
                  <button
                    type="submit"
                    disabled={!items.length || !valid || selectedIds.length === 0 || loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    {loading ? "Procesando..." : "Pagar con tarjeta (Sandbox)"}
                  </button>
                </form>
                {resultadoCompra?.status === 'succeeded' && (
                  <div className="mt-4 text-sm text-green-700 bg-green-50 p-3 rounded">Pago confirmado: {resultadoCompra.id}</div>
                )}
              </div>
            </div>

            {/* Pago contra entrega */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Truck className="h-5 w-5 mr-2 text-blue-600" />
                  Pago contra entrega
                </h3>
              </div>
              <div className="p-6">
                <form onSubmit={pagarContraEntrega} className="space-y-4">
                  <p className="text-sm text-gray-600">Paga en efectivo al recibir el producto. Confirma tu dirección y datos.</p>
                  <button
                    type="submit"
                    disabled={!items.length || !valid || selectedIds.length === 0 || loading}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    {loading ? 'Procesando…' : 'Confirmar pedido (contra entrega)'}
                  </button>
                </form>
              </div>
            </div>

            {/* Pago ficticio (para pruebas) - controlado por flag de entorno */}
            {ENABLE_FAKE_PAYMENT && (
            <div className="bg-yellow-50 rounded-xl border border-yellow-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-yellow-200">
                <h3 className="text-lg font-semibold text-yellow-800">
                  🧪 Modo de Prueba
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Genera comprobantes ficticios para pruebas
                </p>
              </div>
              <div className="p-6">
                <form onSubmit={pagarFicticio} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Documento (modo prueba)</label>
                    <DocumentInput
                      value={dni}
                      onChange={(v) => setDni(v)}
                      onValidationChange={(isValid) => setDocValid(isValid)}
                      placeholder="Ingrese cualquier DNI/RUC para pruebas"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!items.length || !valid || selectedIds.length === 0 || loading}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                  >
                    {loading ? "Procesando..." : "Generar Comprobante Ficticio"}
                  </button>
                </form>

                {resultadoCompra && (
                  <div className="mt-6 space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-800 mb-2">✅ Boleta Generada</h4>
                      <pre className="text-xs text-green-700 whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(resultadoCompra.boleta, null, 2)}
                      </pre>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-800 mb-2">📄 Comprobante</h4>
                      <pre className="text-xs text-blue-700 whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(resultadoCompra.comprobante, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Ventas() {
  return (
    <Elements stripe={stripePromise}>
      <VentasPage />
    </Elements>
  );
}
