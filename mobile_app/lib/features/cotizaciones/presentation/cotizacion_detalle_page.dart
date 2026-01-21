import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../../../core/ui/layout/responsive_layout.dart';
import '../../../domain/entities/cotizacion_detalle.dart';
import '../providers/cotizaciones_providers.dart';

class CotizacionDetallePage extends ConsumerWidget {
  final String id;

  const CotizacionDetallePage({super.key, required this.id});

  Widget _buildImages(BuildContext context, CotizacionDetalle c) {
    if (c.images.isEmpty) return const SizedBox.shrink();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Imágenes Adjuntas',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 140,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: c.images.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final image = c.images[index];
                  return Column(
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: GestureDetector(
                            onTap: () {
                              showDialog(
                                context: context,
                                builder: (_) => Dialog(
                                  insetPadding: const EdgeInsets.all(12),
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Flexible(
                                        child: Image.network(
                                          AppConfig.buildImageUrl(image.imageUrl),
                                          fit: BoxFit.contain,
                                        ),
                                      ),
                                      if (!image.isApproved)
                                        Container(
                                          padding: const EdgeInsets.all(8.0),
                                          color: Colors.orange.shade50,
                                          width: double.infinity,
                                          child: const Text(
                                            'Pendiente de aprobación',
                                            textAlign: TextAlign.center,
                                            style: TextStyle(color: Colors.orange, fontWeight: FontWeight.bold),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              );
                            },
                            child: Image.network(
                              AppConfig.buildImageUrl(image.imageUrl),
                              fit: BoxFit.cover,
                              width: 120,
                              errorBuilder: (context, error, stackTrace) {
                                return Container(
                                  width: 120,
                                  color: Colors.grey[200],
                                  child: const Icon(Icons.broken_image, color: Colors.grey),
                                );
                              },
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            image.isApproved ? Icons.check_circle : Icons.access_time,
                            size: 16,
                            color: image.isApproved ? Colors.green : Colors.orange,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            image.isApproved ? 'Aprobada' : 'Pendiente',
                            style: TextStyle(
                              fontSize: 12,
                              color: image.isApproved ? Colors.green : Colors.orange,
                            ),
                          ),
                        ],
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(String? iso) {
    if (iso == null || iso.isEmpty) return '—';
    try {
      final d = DateTime.parse(iso);
      return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return iso;
    }
  }

  Color _statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'PENDIENTE':
      case 'NUEVA':
        return Colors.orange;
      case 'EN_PROCESO':
      case 'PRODUCCION':
      case 'EN_PRODUCCION':
        return Colors.blue;
      case 'INSTALACION':
        return Colors.purple;
      case 'FINALIZADA':
      case 'FINALIZADO':
      case 'COMPLETADA':
      case 'COMPLETADO':
        return Colors.green;
      case 'CANCELADA':
      case 'CANCELADO':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  String _statusLabel(String status) {
    switch (status.toUpperCase()) {
      case 'EN_PROCESO':
      case 'PROCESANDO':
        return 'En Proceso';
      case 'PRODUCCION':
      case 'EN_PRODUCCION':
        return 'En Producción';
      case 'INSTALACION':
        return 'Instalación';
      case 'FINALIZADA':
      case 'FINALIZADO':
      case 'COMPLETADA':
      case 'COMPLETADO':
        return 'Finalizada';
      case 'PENDIENTE':
        return 'Pendiente';
      case 'CANCELADA':
      case 'CANCELADO':
        return 'Cancelada';
      default:
        return status;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detalleAsync = ref.watch(cotizacionDetalleProvider(id));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Detalle de Cotización'),
        elevation: 0,
        actions: [
          PopupMenuButton<String>(
            onSelected: (value) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Acción $value pendiente de implementación')),
              );
            },
            itemBuilder: (context) => const [
              PopupMenuItem(
                value: 'pdf',
                child: Row(
                  children: [Icon(Icons.picture_as_pdf, color: Colors.grey), SizedBox(width: 8), Text('Descargar PDF')],
                ),
              ),
              PopupMenuItem(
                value: 'share',
                child: Row(
                  children: [Icon(Icons.share, color: Colors.grey), SizedBox(width: 8), Text('Compartir')],
                ),
              ),
              PopupMenuItem(
                value: 'edit',
                child: Row(
                  children: [Icon(Icons.edit, color: Colors.grey), SizedBox(width: 8), Text('Editar')],
                ),
              ),
            ],
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          context.pushNamed('cotizacion-avance', pathParameters: {'id': id});
        },
        icon: const Icon(Icons.update),
        label: const Text('Reportar Avance'),
      ),
      body: detalleAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.red),
                const SizedBox(height: 12),
                Text(
                  'Error al cargar la cotización',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  e.toString(),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: () =>
                      ref.invalidate(cotizacionDetalleProvider(id)),
                  icon: const Icon(Icons.refresh),
                  label: const Text('Reintentar'),
                ),
              ],
            ),
          ),
        ),
        data: (c) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(cotizacionDetalleProvider(id)),
          child: ResponsiveLayout(
            mobile: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _buildClientInfo(context, c),
                const SizedBox(height: 12),
                _buildItems(context, c),
                const SizedBox(height: 12),
                if (c.images.isNotEmpty) ...[
                  _buildImages(context, c),
                  const SizedBox(height: 12),
                ],
                if (c.need != null || c.notes != null) ...[
                  _buildDetails(context, c),
                  const SizedBox(height: 12),
                ],
                if (c.progressUpdates.isNotEmpty) _buildAvances(context, c),
              ],
            ),
            tablet: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  _buildClientInfo(context, c),
                  const SizedBox(height: 24),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        flex: 5,
                        child: Column(
                          children: [
                            _buildItems(context, c),
                            const SizedBox(height: 24),
                            if (c.images.isNotEmpty) ...[
                              _buildImages(context, c),
                              const SizedBox(height: 24),
                            ],
                            if (c.need != null || c.notes != null)
                              _buildDetails(context, c),
                          ],
                        ),
                      ),
                      const SizedBox(width: 24),
                      Expanded(
                        flex: 4,
                        child: c.progressUpdates.isNotEmpty
                            ? _buildAvances(context, c)
                            : const SizedBox.shrink(),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            desktop: SingleChildScrollView(
              padding: const EdgeInsets.all(32),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 4,
                    child: Column(
                      children: [
                        _buildClientInfo(context, c),
                        const SizedBox(height: 24),
                        if (c.need != null || c.notes != null)
                          _buildDetails(context, c),
                      ],
                    ),
                  ),
                  const SizedBox(width: 32),
                  Expanded(
                    flex: 6,
                    child: Column(
                      children: [
                        _buildItems(context, c),
                        const SizedBox(height: 24),
                        if (c.images.isNotEmpty) ...[
                          _buildImages(context, c),
                          const SizedBox(height: 24),
                        ],
                        if (c.progressUpdates.isNotEmpty)
                          _buildAvances(context, c),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildClientInfo(BuildContext context, CotizacionDetalle c) {
    final statusColor = _statusColor(c.status);
    final statusLabel = _statusLabel(c.status);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Theme.of(context)
                        .colorScheme
                        .primary
                        .withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    Icons.description_outlined,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Cotización',
                        style: Theme.of(context)
                            .textTheme
                            .labelMedium
                            ?.copyWith(color: Colors.grey),
                      ),
                      Text(
                        c.code,
                        style: Theme.of(context)
                            .textTheme
                            .titleLarge
                            ?.copyWith(fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: statusColor.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.circle, size: 8, color: statusColor),
                      const SizedBox(width: 6),
                      Text(
                        statusLabel,
                        style: TextStyle(
                          color: statusColor,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            Text(
              c.customerName,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
            if (c.customerPhone != null) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(Icons.phone, size: 16, color: Colors.grey),
                  const SizedBox(width: 6),
                  Text('Tel: ${c.customerPhone}'),
                ],
              ),
            ],
            if (c.customerEmail != null) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.email_outlined, size: 16, color: Colors.grey),
                  const SizedBox(width: 6),
                  Text('Email: ${c.customerEmail}'),
                ],
              ),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Progreso ${c.progressPercent}%',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: 4),
                      LinearProgressIndicator(
                        value: c.progressPercent / 100,
                        minHeight: 8,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.event, size: 16, color: Colors.grey),
                const SizedBox(width: 6),
                Text(
                  'Entrega estimada: ${_formatDate(c.estimatedDeliveryDate)}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildItems(BuildContext context, CotizacionDetalle c) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Items',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            if (c.items.isEmpty)
              const Text('Sin items')
            else
              ...c.items.map(
                (it) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(it.productName ?? 'Producto'),
                  subtitle: Text('Cantidad: ${it.quantity}'),
                  trailing: it.price != null
                      ? Text(
                          '\$${it.price!.toStringAsFixed(2)}',
                          style: const TextStyle(color: Colors.grey),
                        )
                      : null,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetails(BuildContext context, CotizacionDetalle c) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Detalles',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            if (c.need != null) ...[
              Text(
                'Necesidad',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              Text(c.need!),
              const SizedBox(height: 8),
            ],
            if (c.notes != null) ...[
              Text(
                'Notas',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              Text(c.notes!),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildAvances(BuildContext context, CotizacionDetalle c) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Avances',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            ...c.progressUpdates.map(
              (p) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.timeline),
                title: Text(p.message),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_formatDate(p.createdAt)),
                    if (p.status != null)
                      Text('Estado: ${p.status}',
                          style: const TextStyle(fontSize: 12)),
                    if (p.progressPercent != null)
                      Text('Progreso: ${p.progressPercent}%',
                          style: const TextStyle(fontSize: 12)),
                    if (p.materials != null) ...[
                      const SizedBox(height: 4),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: Colors.grey.shade300),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Materiales:',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Text(
                              p.materials!,
                              style: const TextStyle(fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                    ],
                    if (p.attachmentUrls.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      SizedBox(
                        height: 60,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: p.attachmentUrls.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 8),
                          itemBuilder: (context, index) {
                            return Container(
                              width: 60,
                              height: 60,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: Colors.grey.shade300),
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: Image.network(
                                  AppConfig.buildImageUrl(p.attachmentUrls[index]),
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => const Icon(
                                    Icons.broken_image,
                                    size: 20,
                                    color: Colors.grey,
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                    if (p.author != null) ...[
                      const SizedBox(height: 4),
                      Text('Autor: ${p.author}',
                          style: const TextStyle(fontSize: 12, color: Colors.grey)),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
