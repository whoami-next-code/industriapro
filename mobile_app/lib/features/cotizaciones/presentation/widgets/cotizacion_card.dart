import 'package:flutter/material.dart';
import '../../../../domain/entities/cotizacion_detalle.dart';
import 'package:intl/intl.dart';

class CotizacionCard extends StatelessWidget {
  const CotizacionCard({
    super.key,
    required this.cotizacion,
    required this.onTap,
  });

  final CotizacionDetalle cotizacion;
  final VoidCallback onTap;

  Color _getEstadoColor(String estado) {
    switch (estado.toUpperCase()) {
      case 'PENDIENTE':
      case 'NUEVA':
        return Colors.orange;
      case 'EN_PROCESO':
      case 'PROCESANDO':
        return Colors.blue;
      case 'APROBADO':
      case 'COMPLETADO':
      case 'FINALIZADA':
      case 'TERMINADO':
        return Colors.green;
      case 'RECHAZADO':
      case 'CANCELADO':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }

  IconData _getEstadoIcon(String estado) {
    switch (estado.toUpperCase()) {
      case 'PENDIENTE':
      case 'NUEVA':
        return Icons.pending;
      case 'EN_PROCESO':
      case 'PROCESANDO':
        return Icons.build;
      case 'APROBADO':
      case 'COMPLETADO':
      case 'FINALIZADA':
      case 'TERMINADO':
        return Icons.check_circle;
      case 'RECHAZADO':
      case 'CANCELADO':
        return Icons.cancel;
      default:
        return Icons.info;
    }
  }

  @override
  Widget build(BuildContext context) {
    final estadoColor = _getEstadoColor(cotizacion.status);
    final estadoIcon = _getEstadoIcon(cotizacion.status);
    final theme = Theme.of(context);
    final currencyFormat = NumberFormat.currency(symbol: '\$');

    return Card(
      elevation: 2,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '#${cotizacion.code}',
                          style: theme.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          cotizacion.customerName,
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: estadoColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: estadoColor.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(estadoIcon, size: 14, color: estadoColor),
                        const SizedBox(width: 4),
                        Text(
                          cotizacion.status.toUpperCase(),
                          style: TextStyle(
                            color: estadoColor,
                            fontWeight: FontWeight.bold,
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (cotizacion.totalAmount != null) ...[
                Row(
                  children: [
                    Icon(Icons.attach_money,
                        size: 16, color: theme.colorScheme.onSurfaceVariant),
                    const SizedBox(width: 4),
                    Text(
                      currencyFormat.format(cotizacion.totalAmount),
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
              ],
              Row(
                children: [
                  Icon(Icons.calendar_today,
                      size: 16, color: theme.colorScheme.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text(
                    _formatDate(cotizacion.estimatedDeliveryDate),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null) return '--/--/----';
    try {
      final date = DateTime.parse(dateStr);
      return DateFormat('dd/MM/yyyy').format(date);
    } catch (e) {
      return dateStr;
    }
  }
}
