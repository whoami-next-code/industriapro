import { Injectable } from '@nestjs/common';
import axios from 'axios';

export interface ComprobanteData {
  orderNumber: string;
  customerName: string;
  customerDni: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress: string;
  items: Array<{
    productId: number;
    name: string;
    price: number;
    quantity: number;
    total: number;
  }>;
  subtotal: number;
  shipping: number;
  total: number;
  paymentMethod: 'CARD' | 'CASH_ON_DELIVERY';
  paymentStatus: string;
  orderDate: Date;
  notes?: string;
}

export interface ComprobanteResponse {
  id: string;
  type: 'VOUCHER' | 'BOLETA';
  orderNumber: string;
  issueDate: Date;
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

@Injectable()
export class ComprobantesService {
  private readonly companyInfo = {
    name: 'IndustriaSP',
    ruc: '20123456789',
    address: 'Av. Industrial 123, Lima, Perú',
    phone: '+51 1 234-5678',
    email: 'ventas@industriasp.com',
  };

  async generateComprobante(
    orderData: ComprobanteData,
  ): Promise<ComprobanteResponse> {
    // Determinar tipo de comprobante basado en el DNI/RUC
    const documentType = this.getDocumentType(orderData.customerDni);
    const comprobanteType = documentType === 'RUC' ? 'BOLETA' : 'VOUCHER';

    // Generar ID único para el comprobante
    const comprobanteId = this.generateComprobanteId(comprobanteType);

    // Generar hash de seguridad
    const hash = this.generateSecurityHash(orderData, comprobanteId);

    // Preparar información del cliente
    const customerInfo = {
      name: orderData.customerName,
      document: orderData.customerDni,
      documentType,
      email: orderData.customerEmail,
      phone: orderData.customerPhone,
    };

    // Preparar items del comprobante
    const items = orderData.items.map((item) => ({
      description: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      total: item.total,
    }));

    // Preparar totales
    const totals = {
      subtotal: orderData.subtotal,
      shipping: orderData.shipping,
      total: orderData.total,
    };

    // Preparar información de pago
    const paymentInfo = {
      method:
        orderData.paymentMethod === 'CARD'
          ? 'Tarjeta de Crédito/Débito'
          : 'Pago Contra Entrega',
      status: this.getPaymentStatusText(orderData.paymentStatus),
    };

    // Generar código QR (simulado)
    const qrCode = this.generateQRCode(comprobanteId, hash);

    const comprobante: ComprobanteResponse = {
      id: comprobanteId,
      type: comprobanteType,
      orderNumber: orderData.orderNumber,
      issueDate: new Date(),
      customerInfo,
      companyInfo: this.companyInfo,
      items,
      totals,
      paymentInfo,
      qrCode,
      hash,
    };

    return comprobante;
  }

  private buildNubefactItems(orderData: ComprobanteData) {
    return orderData.items.map((item) => {
      const quantity = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      const total = price * quantity;
      const valorUnitario = price / 1.18;
      const subtotal = valorUnitario * quantity;
      const igv = total - subtotal;
      return {
        unidad_de_medida: 'NIU',
        codigo: String(item.productId || ''),
        descripcion: item.name,
        cantidad: quantity,
        valor_unitario: Number(valorUnitario.toFixed(2)),
        precio_unitario: Number(price.toFixed(2)),
        subtotal: Number(subtotal.toFixed(2)),
        tipo_de_igv: '1',
        igv: Number(igv.toFixed(2)),
        total: Number(total.toFixed(2)),
      };
    });
  }

  private async sendToNubefact(
    orderData: ComprobanteData,
    tipoComprobante: '1' | '2',
    serie: string,
    clienteTipoDocumento: '6' | '1',
  ) {
    const apiUrl = process.env.NUBEFACT_API_URL;
    const token = process.env.NUBEFACT_TOKEN;
    if (!apiUrl || !token) {
      return { ok: false, error: 'NUBEFACT no configurado' };
    }

    const now = new Date();
    const numberSeed = String(now.getTime()).slice(-6);
    const payload = {
      operacion: 'generar_comprobante',
      tipo_de_comprobante: tipoComprobante,
      serie,
      numero: Number(numberSeed),
      sunat_transaction: 1,
      cliente_tipo_de_documento: clienteTipoDocumento,
      cliente_numero_de_documento: orderData.customerDni,
      cliente_denominacion: orderData.customerName,
      cliente_direccion: orderData.shippingAddress,
      cliente_email: orderData.customerEmail,
      cliente_telefono: orderData.customerPhone,
      fecha_de_emision: now.toISOString().slice(0, 10),
      moneda: '1',
      porcentaje_de_igv: 18,
      total_igv: Number((orderData.total - orderData.subtotal).toFixed(2)),
      total_gravada: Number(orderData.subtotal.toFixed(2)),
      total: Number(orderData.total.toFixed(2)),
      enviar_automaticamente_al_cliente: false,
      items: this.buildNubefactItems(orderData),
    };

    try {
      const { data } = await axios.post(apiUrl.trim(), payload, {
        headers: {
          Authorization: `Token token=${token}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      });
      return { ok: true, data };
    } catch (err: any) {
      const message = err?.response?.data ?? err?.message ?? 'NUBEFACT error';
      return { ok: false, error: message };
    }
  }

  async generateFacturaNubefact(orderData: ComprobanteData) {
    return this.sendToNubefact(orderData, '1', 'F001', '6');
  }

  async generateBoletaNubefact(orderData: ComprobanteData) {
    return this.sendToNubefact(orderData, '2', 'B001', '1');
  }

  normalizeNubefactForEmail(
    nubefactData: any,
    orderData: ComprobanteData,
    documentType: 'BOLETA' | 'FACTURA',
  ) {
    return {
      id: nubefactData?.numero ?? nubefactData?.id ?? orderData.orderNumber,
      type: documentType,
      orderNumber: orderData.orderNumber,
      issueDate: new Date(),
      items: orderData.items.map((item) => ({
        description: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        total: item.total,
      })),
      totals: {
        subtotal: orderData.subtotal,
        shipping: orderData.shipping,
        total: orderData.total,
      },
    };
  }

  private getDocumentType(document: string): 'DNI' | 'RUC' {
    // RUC tiene 11 dígitos, DNI tiene 8
    return document.length === 11 ? 'RUC' : 'DNI';
  }

  private generateComprobanteId(type: 'VOUCHER' | 'BOLETA'): string {
    const prefix = type === 'BOLETA' ? 'B001' : 'V001';
    const number = Math.floor(Math.random() * 999999) + 1;
    return `${prefix}-${number.toString().padStart(6, '0')}`;
  }

  private generateSecurityHash(
    orderData: ComprobanteData,
    comprobanteId: string,
  ): string {
    const dataToHash = `${comprobanteId}${orderData.orderNumber}${orderData.total}${orderData.customerDni}`;
    // En producción, usar una librería de hash real como crypto
    return Buffer.from(dataToHash).toString('base64').substring(0, 16);
  }

  private generateQRCode(comprobanteId: string, hash: string): string {
    // En producción, generar un QR real que apunte a la verificación del comprobante
    const qrData = `https://industriasp.com/verify/${comprobanteId}?hash=${hash}`;
    return `data:image/svg+xml;base64,${Buffer.from(this.generateQRSVG(qrData)).toString('base64')}`;
  }

  private generateQRSVG(data: string): string {
    // SVG simple simulando un código QR
    return `
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="white"/>
        <rect x="10" y="10" width="80" height="80" fill="none" stroke="black" stroke-width="2"/>
        <rect x="20" y="20" width="10" height="10" fill="black"/>
        <rect x="40" y="20" width="10" height="10" fill="black"/>
        <rect x="60" y="20" width="10" height="10" fill="black"/>
        <rect x="20" y="40" width="10" height="10" fill="black"/>
        <rect x="60" y="40" width="10" height="10" fill="black"/>
        <rect x="20" y="60" width="10" height="10" fill="black"/>
        <rect x="40" y="60" width="10" height="10" fill="black"/>
        <rect x="60" y="60" width="10" height="10" fill="black"/>
        <text x="50" y="95" text-anchor="middle" font-size="8" fill="black">QR Code</text>
      </svg>
    `;
  }

  private getPaymentStatusText(status: string): string {
    // Map tipado para evitar TS7053 (no index signature)
    const statusMap: Record<string, string> = {
      PENDING: 'Pendiente',
      COMPLETED: 'Completado',
      FAILED: 'Fallido',
      REFUNDED: 'Reembolsado',
    };
    return statusMap[status] ?? status;
  }

  async getComprobante(
    comprobanteId: string,
  ): Promise<ComprobanteResponse | null> {
    // En producción, esto consultaría la base de datos
    // Por ahora retornamos null para simular que no existe
    return null;
  }

  async verifyComprobante(
    comprobanteId: string,
    hash: string,
  ): Promise<boolean> {
    // En producción, esto verificaría el hash contra la base de datos
    // Por ahora retornamos true para simular verificación exitosa
    return true;
  }

  async generatePDF(comprobante: ComprobanteResponse): Promise<Buffer> {
    // En producción, usar una librería como pdfkit o puppeteer para generar PDF real
    // Por ahora, generamos un PDF básico usando texto plano
    const pdfContent = `
COMPROBANTE ELECTRÓNICO
${comprobante.type === 'BOLETA' ? 'BOLETA DE VENTA' : 'VOUCHER DE VENTA'}

ID: ${comprobante.id}
Número de Pedido: ${comprobante.orderNumber}
Fecha de Emisión: ${comprobante.issueDate.toLocaleDateString('es-PE')}

EMPRESA:
${comprobante.companyInfo.name}
RUC: ${comprobante.companyInfo.ruc}
${comprobante.companyInfo.address}
Tel: ${comprobante.companyInfo.phone}
Email: ${comprobante.companyInfo.email}

CLIENTE:
${comprobante.customerInfo.name}
${comprobante.customerInfo.documentType}: ${comprobante.customerInfo.document}
${comprobante.customerInfo.email ? `Email: ${comprobante.customerInfo.email}` : ''}
${comprobante.customerInfo.phone ? `Tel: ${comprobante.customerInfo.phone}` : ''}

ITEMS:
${comprobante.items.map((item, i) => `${i + 1}. ${item.description} - Cant: ${item.quantity} - Precio: S/ ${item.unitPrice.toFixed(2)} - Total: S/ ${item.total.toFixed(2)}`).join('\n')}

TOTALES:
Subtotal: S/ ${comprobante.totals.subtotal.toFixed(2)}
Envío: S/ ${comprobante.totals.shipping.toFixed(2)}
TOTAL: S/ ${comprobante.totals.total.toFixed(2)}

Método de Pago: ${comprobante.paymentInfo.method}
Estado: ${comprobante.paymentInfo.status}

Hash de Seguridad: ${comprobante.hash}
`;

    // Convertir a Buffer (en producción, usar pdfkit para generar PDF real)
    return Buffer.from(pdfContent, 'utf-8');
  }
}
