import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../../domain/entities/trabajo.dart';

class TrabajoCard extends StatelessWidget {
  const TrabajoCard({
    super.key,
    required this.trabajo,
    required this.onTap,
  });

  final Trabajo trabajo;
  final VoidCallback onTap;

  Color _getEstadoColor(String estado) {
    switch (estado.toUpperCase()) {
      case 'PENDIENTE':
      case 'NUEVA':
        return Colors.orange;
      case 'EN_PROCESO':
      case 'PROCESANDO':
      case 'PRODUCCION':
      case 'EN_PRODUCCION':
        return Colors.blue;
      case 'INSTALACION':
        return Colors.purple;
      case 'COMPLETADO':
      case 'FINALIZADA':
      case 'FINALIZADO':
        return Colors.green;
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
      case 'PRODUCCION':
      case 'EN_PRODUCCION':
        return Icons.build;
      case 'INSTALACION':
        return Icons.home_repair_service;
      case 'COMPLETADO':
      case 'FINALIZADA':
      case 'FINALIZADO':
        return Icons.check_circle;
      case 'CANCELADO':
        return Icons.cancel;
      default:
        return Icons.info;
    }
  }

  String _getEstadoLabel(String estado) {
    switch (estado.toUpperCase()) {
      case 'PENDIENTE':
      case 'NUEVA':
        return 'Pendiente';
      case 'EN_PROCESO':
      case 'PROCESANDO':
        return 'En Proceso';
      case 'PRODUCCION':
      case 'EN_PRODUCCION':
        return 'En Producción';
      case 'INSTALACION':
        return 'Instalación';
      case 'COMPLETADO':
      case 'FINALIZADA':
      case 'FINALIZADO':
        return 'Finalizado';
      case 'CANCELADO':
        return 'Cancelado';
      default:
        return estado;
    }
  }

  @override
  Widget build(BuildContext context) {
    final estadoColor = _getEstadoColor(trabajo.estado);
    final estadoIcon = _getEstadoIcon(trabajo.estado);
    final theme = Theme.of(context);
    final now = DateTime.now();
    final isUrgent = trabajo.fechaLimite != null &&
        trabajo.fechaLimite!.isBefore(now.add(const Duration(hours: 24))) &&
        trabajo.progreso < 100;
    final isOverdue = trabajo.fechaLimite != null &&
        trabajo.fechaLimite!.isBefore(now) &&
        trabajo.progreso < 100;

    return Card(
      elevation: 2,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: isOverdue
              ? Colors.red.withValues(alpha: 0.5)
              : isUrgent
                  ? Colors.orange.withValues(alpha: 0.3)
                  : Colors.transparent,
          width: isOverdue || isUrgent ? 2 : 0,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: Código y Estado
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          trabajo.codigo,
                          style: theme.textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          trabajo.cliente,
                          style: theme.textTheme.bodyLarge?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: estadoColor.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: estadoColor.withValues(alpha: 0.3), width: 1.5),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(estadoIcon, size: 18, color: estadoColor),
                        const SizedBox(width: 6),
                        Text(
                          _getEstadoLabel(trabajo.estado),
                          style: TextStyle(
                            color: estadoColor,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              
              const SizedBox(height: 16),
              
              // Equipo/Producto
              Row(
                children: [
                  Icon(
                    Icons.precision_manufacturing,
                    size: 18,
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      trabajo.equipo.isNotEmpty ? trabajo.equipo : 'Sin especificar',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              
              const SizedBox(height: 16),
              
              // Progreso y Fecha límite
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Progreso',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            Text(
                              '${trabajo.progreso}%',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.primary,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        LinearProgressIndicator(
                          value: trabajo.progreso / 100,
                          backgroundColor: theme.colorScheme.surfaceContainerHighest,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            theme.colorScheme.primary,
                          ),
                          minHeight: 8,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ],
                    ),
                  ),
                  if (trabajo.fechaLimite != null) ...[
                    const SizedBox(width: 16),
                    _buildFechaCompromiso(context),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFechaCompromiso(BuildContext context) {
    final now = DateTime.now();
    final fechaLimite = trabajo.fechaLimite!;
    final difference = fechaLimite.difference(now);
    final isOverdue = difference.isNegative;
    final isUrgent = !isOverdue && difference.inHours <= 24;

    Color backgroundColor;
    Color textColor;
    Color iconColor;
    IconData icon;

    if (isOverdue) {
      backgroundColor = Colors.red[50]!;
      textColor = Colors.red[700]!;
      iconColor = Colors.red;
      icon = Icons.warning;
    } else if (isUrgent) {
      backgroundColor = Colors.orange[50]!;
      textColor = Colors.orange[700]!;
      iconColor = Colors.orange;
      icon = Icons.schedule;
    } else {
      backgroundColor = Colors.blue[50]!;
      textColor = Colors.blue[700]!;
      iconColor = Colors.blue;
      icon = Icons.calendar_today;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: iconColor.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: iconColor),
              const SizedBox(width: 4),
              Text(
                'Compromiso',
                style: TextStyle(
                  color: textColor,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            _formatFechaCompromiso(fechaLimite, now),
            style: TextStyle(
              color: textColor,
              fontWeight: FontWeight.bold,
              fontSize: 12,
            ),
          ),
          if (fechaLimite.hour != 0 || fechaLimite.minute != 0)
            Text(
              DateFormat('HH:mm').format(fechaLimite),
              style: TextStyle(
                color: textColor.withValues(alpha: 0.8),
                fontSize: 10,
              ),
            ),
        ],
      ),
    );
  }

  String _formatFechaCompromiso(DateTime fechaLimite, DateTime now) {
    final difference = fechaLimite.difference(now);

    if (difference.isNegative) {
      final days = -difference.inDays;
      if (days == 0) {
        return 'Vencido hoy';
      } else if (days == 1) {
        return 'Vencido ayer';
      } else {
        return 'Vencido hace $days días';
      }
    } else if (difference.inDays == 0) {
      return 'Hoy';
    } else if (difference.inDays == 1) {
      return 'Mañana';
    } else if (difference.inDays < 7) {
      return 'En ${difference.inDays} días';
    } else {
      return DateFormat('dd/MM/yyyy').format(fechaLimite);
    }
  }
}
