"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { 
  CheckCircle, 
  Download, 
  Printer, 
  Share2, 
  ArrowLeft,
  Package,
  CreditCard,
  Truck,
  Calendar,
  MapPin,
  User,
  FileText,
  Phone,
  Mail,
  Clock,
  AlertCircle,
  Shield,
  QrCode
} from "lucide-react";
import { API_URL } from "@/lib/api";

const API_BASE = API_URL;

interface OrderData {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: 'card' | 'cash_on_delivery';
  total: number;
  createdAt: string;
  estimatedDelivery: string;
  customer: {
    name: string;
    document: string;
    documentType: 'dni' | 'ruc';
    phone: string;
    email?: string;
    address: string;
  };
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  receipt?: {
    id: string;
    type: 'boleta' | 'factura';
    series: string;
    number: string;
    issueDate: string;
    dueDate?: string;
    subtotal: number;
    igv: number;
    total: number;
  };
}

interface ComprobanteData {
  id: string;
  type: 'VOUCHER' | 'BOLETA';
  orderNumber: string;
  issueDate: string;
  customerInfo: {
    name: string;
    document: string;
    documentType: 'DNI' | 'RUC';
    email?: string;
    phone?: string;
  };
  companyInfo: {
    name: string;
    ruc: string;
    address: string;
    phone: string;
    email: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  totals: {
    subtotal: number;
    shipping: number;
    total: number;
  };
  paymentInfo: {
    method: string;
    status: string;
  };
  qrCode?: string;
  hash: string;
}

function ConfirmacionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [comprobante, setComprobante] = useState<ComprobanteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);

  const paymentId = searchParams?.get('paymentId');
  const orderId = searchParams?.get('orderId');
  const method = (searchParams?.get('method') as 'card' | 'cash_on_delivery') ?? null;

  useEffect(() => {
    const fetchOrderData = async () => {
      try {
        let endpoint = '';
        let params = {};

        if (paymentId && method === 'card') {
          endpoint = '/pedidos/by-payment';
          params = { paymentId };
        } else if (orderId && method === 'cash_on_delivery') {
          endpoint = '/pedidos/by-order-id';
          params = { orderId };
        } else {
          throw new Error('Parámetros de confirmación inválidos');
        }

        const response = await axios.get(`${API_BASE}${endpoint}`, { params });
        
        if (response.data?.ok) {
          setOrderData(response.data.order);
          // Generar comprobante electrónico
          await generateComprobante(response.data.order);
        } else {
          throw new Error(response.data?.error || 'No se pudo obtener la información del pedido');
        }
      } catch (err: any) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error fetching order:', err);
        }
        setError(err?.response?.data?.message || err?.message || 'Error cargando la confirmación');
      } finally {
        setLoading(false);
      }
    };

    if (paymentId || orderId) {
      fetchOrderData();
    } else {
      setError('No se encontraron parámetros de confirmación');
      setLoading(false);
    }
  }, [paymentId, orderId, method]);

  const generateComprobante = async (order: OrderData) => {
    try {
      const comprobanteData = {
        orderNumber: order.orderNumber,
        customerName: order.customer.name,
        customerDocument: order.customer.document,
        customerDocumentType: order.customer.documentType,
        customerEmail: order.customer.email,
        customerPhone: order.customer.phone,
        shippingAddress: order.customer.address,
        items: order.items,
        total: order.total,
        paymentMethod: order.paymentMethod,
        orderDate: new Date(order.createdAt)
      };

      const response = await axios.post(`${API_BASE}/comprobantes/generar`, comprobanteData);
      
      if (response.data?.ok && response.data.comprobante) {
        setComprobante(response.data.comprobante);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error generating comprobante:', error);
      }
    }
  };

  const handleDownloadReceipt = async () => {
    if (!comprobante) return;
    
    setDownloadingReceipt(true);
    try {
      const response = await axios.get(`${API_BASE}/comprobantes/${comprobante.id}/download`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${comprobante.type}-${comprobante.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error downloading receipt:', err);
      }
      alert('Error al descargar el comprobante. Inténtalo de nuevo.');
    } finally {
      setDownloadingReceipt(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleShareOrder = async () => {
    if (navigator.share && orderData) {
      try {
        await navigator.share({
          title: `Pedido ${orderData.orderNumber} - IndustriaSP`,
          text: `Mi pedido ha sido confirmado. Total: $${orderData.total.toFixed(2)}`,
          url: window.location.href
        });
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.log('Error sharing:', err);
        }
      }
    } else {
      // Fallback: copiar URL al clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Enlace copiado al portapapeles');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Cargando confirmación...</h2>
            <p className="text-gray-600">Por favor espera mientras procesamos tu información.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => router.push('/ventas')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Pedido no encontrado</h2>
            <p className="text-gray-600 mb-6">No se pudo encontrar la información del pedido.</p>
            <button
              onClick={() => router.push('/ventas')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header de confirmación */}
        <div className="text-center mb-8">
          <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {method === 'card' ? '¡Pago Exitoso!' : '¡Pedido Confirmado!'}
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            {method === 'card' 
              ? 'Tu pago ha sido procesado correctamente y tu pedido está confirmado.'
              : 'Tu pedido ha sido registrado exitosamente. Pagarás al recibir el producto.'
            }
          </p>
          <div className="bg-white rounded-lg p-4 inline-block shadow-sm border">
            <p className="text-sm text-gray-600">Número de pedido</p>
            <p className="text-2xl font-bold text-blue-600">{orderData.orderNumber}</p>
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          <button
            onClick={() => router.push('/ventas')}
            className="flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al inicio
          </button>
          
          {comprobante && (
            <>
              <button
                onClick={handleDownloadReceipt}
                disabled={downloadingReceipt}
                className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
              >
                {downloadingReceipt ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Descargar Comprobante
              </button>
              
              <button
                onClick={handlePrintReceipt}
                className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </button>
            </>
          )}
          
          <button
            onClick={handleShareOrder}
            className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Compartir
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Información principal del pedido */}
          <div className="lg:col-span-2 space-y-6">
            {/* Detalles del pedido */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Package className="h-5 w-5 mr-2 text-blue-600" />
                  Detalles del Pedido
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Estado del Pedido</p>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                      <span className="text-green-700 font-medium capitalize">{orderData.status}</span>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Método de Pago</p>
                    <div className="flex items-center">
                      {method === 'card' ? (
                        <CreditCard className="h-4 w-4 text-blue-600 mr-2" />
                      ) : (
                        <Truck className="h-4 w-4 text-green-600 mr-2" />
                      )}
                      <span className="text-gray-900">
                        {method === 'card' ? 'Tarjeta de Crédito/Débito' : 'Pago Contra Entrega'}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Fecha del Pedido</p>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 text-gray-500 mr-2" />
                      <span className="text-gray-900">
                        {new Date(orderData.createdAt).toLocaleDateString('es-PE', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Entrega Estimada</p>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-orange-500 mr-2" />
                      <span className="text-gray-900">
                        {new Date(orderData.estimatedDelivery).toLocaleDateString('es-PE', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lista de productos */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Productos Pedidos</h4>
                  <div className="space-y-3">
                    {orderData.items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900">{item.name}</h5>
                          <p className="text-sm text-gray-600">
                            Cantidad: {item.quantity} × ${item.unitPrice.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">${item.total.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t mt-4 pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-gray-900">Total del Pedido:</span>
                      <span className="text-2xl font-bold text-blue-600">${orderData.total.toFixed(2)}</span>
                    </div>
                  </div>
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
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Nombre Completo</p>
                    <p className="text-gray-900">{orderData.customer.name}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      {orderData.customer.documentType === 'dni' ? 'DNI' : 'RUC'}
                    </p>
                    <p className="text-gray-900">{orderData.customer.document}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Teléfono</p>
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 text-gray-500 mr-2" />
                      <span className="text-gray-900">{orderData.customer.phone}</span>
                    </div>
                  </div>
                  
                  {orderData.customer.email && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Email</p>
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 text-gray-500 mr-2" />
                        <span className="text-gray-900">{orderData.customer.email}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="md:col-span-2">
                    <p className="text-sm font-medium text-gray-700 mb-1">Dirección de Entrega</p>
                    <div className="flex items-start">
                      <MapPin className="h-4 w-4 text-gray-500 mr-2 mt-0.5" />
                      <span className="text-gray-900">{orderData.customer.address}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - Comprobante y próximos pasos */}
          <div className="space-y-6">
            {/* Comprobante electrónico */}
            {comprobante && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-green-600" />
                    Comprobante Electrónico
                  </h3>
                </div>
                <div className="p-6">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tipo:</span>
                      <span className="font-medium text-gray-900 capitalize">{comprobante.type === 'BOLETA' ? 'Boleta Electrónica' : 'Voucher de Venta'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">ID:</span>
                      <span className="font-medium text-gray-900">{comprobante.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Pedido:</span>
                      <span className="font-medium text-gray-900">{comprobante.orderNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Fecha de Emisión:</span>
                      <span className="font-medium text-gray-900">
                        {new Date(comprobante.issueDate).toLocaleDateString('es-PE')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Hash:</span>
                      <span className="font-medium text-gray-900 text-xs">{comprobante.hash}</span>
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-medium text-gray-900">S/ {comprobante.totals.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Envío:</span>
                        <span className="font-medium text-gray-900">S/ {comprobante.totals.shipping.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg border-t pt-2">
                        <span className="text-gray-900">Total:</span>
                        <span className="text-blue-600">S/ {comprobante.totals.total.toFixed(2)}</span>
                      </div>
                    </div>
                    {comprobante.qrCode && (
                      <div className="border-t pt-3 text-center">
                        <p className="text-gray-600 mb-2">Código QR de Verificación</p>
                        <img src={comprobante.qrCode} alt="QR Code" className="w-20 h-20 mx-auto" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Próximos pasos */}
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
              <h4 className="text-lg font-semibold text-blue-900 mb-4">Próximos Pasos</h4>
              <div className="space-y-3 text-sm text-blue-800">
                {method === 'card' ? (
                  <>
                    <div className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                      <span>Pago procesado exitosamente</span>
                    </div>
                    <div className="flex items-start">
                      <Package className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                      <span>Tu pedido está siendo preparado</span>
                    </div>
                    <div className="flex items-start">
                      <Truck className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                      <span>Recibirás notificación cuando sea enviado</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start">
                      <CheckCircle className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                      <span>Pedido registrado exitosamente</span>
                    </div>
                    <div className="flex items-start">
                      <Package className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                      <span>Tu pedido está siendo preparado</span>
                    </div>
                    <div className="flex items-start">
                      <Phone className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                      <span>Te contactaremos antes de la entrega</span>
                    </div>
                    <div className="flex items-start">
                      <Truck className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                      <span>Ten preparado el monto exacto: ${orderData.total.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Información de verificación */}
            {comprobante && (
              <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
                <h4 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Verificación del Comprobante
                </h4>
                <div className="space-y-3 text-sm text-blue-800">
                  <div className="flex items-start">
                    <CheckCircle className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                    <span>Comprobante electrónico válido</span>
                  </div>
                  <div className="flex items-start">
                    <Shield className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                    <span>Hash de seguridad: {comprobante.hash.substring(0, 16)}...</span>
                  </div>
                  {comprobante.qrCode && (
                    <div className="flex items-start">
                      <QrCode className="h-4 w-4 text-blue-600 mr-2 mt-0.5" />
                      <span>Código QR disponible para verificación</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Información de contacto */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">¿Necesitas Ayuda?</h4>
              <div className="space-y-3 text-sm text-gray-700">
                <div className="flex items-center">
                  <Phone className="h-4 w-4 text-gray-500 mr-2" />
                  <span>+51 999 888 777</span>
                </div>
                <div className="flex items-center">
                  <Mail className="h-4 w-4 text-gray-500 mr-2" />
                  <span>soporte@industriasp.com</span>
                </div>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 text-gray-500 mr-2" />
                  <span>Lun-Sáb: 9:00 AM - 6:00 PM</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmacionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Cargando confirmación...</h2>
            <p className="text-gray-600">Por favor espera mientras procesamos tu información.</p>
          </div>
        </div>
      </div>
    }>
      <ConfirmacionContent />
    </Suspense>
  );
}
