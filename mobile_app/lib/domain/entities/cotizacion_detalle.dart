import 'quotation_image.dart';

class CotizacionDetalle {
  const CotizacionDetalle({
    required this.id,
    required this.code,
    required this.customerName,
    required this.status,
    required this.items,
    required this.progressPercent,
    this.need,
    this.customerEmail,
    this.customerPhone,
    this.estimatedDeliveryDate,
    this.totalAmount,
    this.notes,
    this.progressUpdates = const [],
    this.images = const [],
  });

  final int id;
  final String code;
  final String customerName;
  final String status;
  final List<CotizacionItemDetalle> items;
  final int progressPercent;
  final String? need;
  final String? customerEmail;
  final String? customerPhone;
  final String? estimatedDeliveryDate;
  final double? totalAmount;
  final String? notes;
  final List<ProgressUpdate> progressUpdates;
  final List<QuotationImage> images;

  factory CotizacionDetalle.fromJson(Map<String, dynamic> json) {
    final items = (json['items'] as List<dynamic>? ?? [])
        .map((e) => CotizacionItemDetalle.fromJson(e as Map<String, dynamic>))
        .toList();

    final progress = (json['progressUpdates'] as List<dynamic>? ?? [])
        .map((e) => ProgressUpdate.fromJson(e as Map<String, dynamic>))
        .toList();

    final images = (json['images'] as List<dynamic>? ?? [])
        .map((e) => QuotationImage.fromJson(e as Map<String, dynamic>))
        .toList();

    int normalizeProgress(dynamic value) {
      if (value is num) return value.clamp(0, 100).toInt();
      return 0;
    }

    return CotizacionDetalle(
      id: (json['id'] ?? 0) is String
          ? int.tryParse(json['id'].toString()) ?? 0
          : (json['id'] ?? 0) as int,
      code: json['code']?.toString() ??
          json['orderNumber']?.toString() ??
          'COT-${json['id'] ?? ''}',
      customerName: json['customerName']?.toString() ?? 'Sin nombre',
      status: json['status']?.toString() ?? 'PENDIENTE',
      items: items,
      progressPercent: normalizeProgress(json['progressPercent']),
      need: json['need']?.toString(),
      customerEmail: json['customerEmail']?.toString(),
      customerPhone: json['customerPhone']?.toString(),
      estimatedDeliveryDate: json['estimatedDeliveryDate']?.toString() ??
          json['estimatedDate']?.toString(),
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ??
          (json['budget'] is num ? (json['budget'] as num).toDouble() : null),
      notes: json['notes']?.toString(),
      progressUpdates: progress,
      images: images,
    );
  }
}

class CotizacionItemDetalle {
  const CotizacionItemDetalle({
    required this.quantity,
    this.productId,
    this.productName,
    this.price,
  });

  final int? productId;
  final String? productName;
  final int quantity;
  final double? price;

  factory CotizacionItemDetalle.fromJson(Map<String, dynamic> json) {
    return CotizacionItemDetalle(
      productId: json['productId'] as int?,
      productName: json['productName']?.toString() ??
          json['name']?.toString() ??
          json['producto']?.toString(),
      quantity: (json['quantity'] ?? 1) is String
          ? int.tryParse(json['quantity'].toString()) ?? 1
          : (json['quantity'] ?? 1) as int,
      price: (json['price'] as num?)?.toDouble(),
    );
  }
}

class ProgressUpdate {
  const ProgressUpdate({
    required this.message,
    required this.createdAt,
    this.status,
    this.progressPercent,
    this.attachmentUrls = const [],
    this.materials,
    this.author,
  });

  final String message;
  final String createdAt;
  final String? status;
  final int? progressPercent;
  final List<String> attachmentUrls;
  final String? materials;
  final String? author;

  factory ProgressUpdate.fromJson(Map<String, dynamic> json) {
    final attachments = (json['attachmentUrls'] as List<dynamic>? ?? [])
        .map((e) => e.toString())
        .toList();
    int? pct;
    final rawPct = json['progressPercent'];
    if (rawPct is num) pct = rawPct.clamp(0, 100).toInt();
    return ProgressUpdate(
      message: json['message']?.toString() ?? 'Sin mensaje',
      createdAt: json['createdAt']?.toString() ?? '',
      status: json['status']?.toString(),
      progressPercent: pct,
      attachmentUrls: attachments,
      materials: json['materials']?.toString(),
      author: json['author']?.toString(),
    );
  }
}

