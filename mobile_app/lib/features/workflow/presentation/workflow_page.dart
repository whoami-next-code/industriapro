import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/events/app_event.dart';
import '../../../domain/entities/workflow_item.dart';
import '../providers/workflow_providers.dart';

class WorkflowPage extends ConsumerWidget {
  const WorkflowPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(workflowProvider);
    final controller = ref.read(workflowProvider.notifier);

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Header(
                onSimulate: controller.simulateSequentialEvents,
                pendingCount: state.pendingRequests.length,
              ),
              const SizedBox(height: 24),
              _StatusStepper(),
              const SizedBox(height: 16),
              Text(
                'Mis proyectos',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 12),
              ...state.items.map(
                (item) => _WorkflowCard(
                  item: item,
                  onAdvance: controller.nextStatus(item.estado) == null
                      ? null
                      : () => controller.requestTransition(
                            item.id,
                            controller.nextStatus(item.estado)!,
                          ),
                ),
              ),
              const SizedBox(height: 24),
              _ApprovalsSection(
                requests: state.pendingRequests,
                onApprove: controller.approveRequest,
                onReject: (id, obs) => controller.rejectRequest(id, obs),
              ),
              const SizedBox(height: 24),
              _TimelineSection(events: state.timeline),
            ],
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.onSimulate,
    required this.pendingCount,
  });

  final VoidCallback onSimulate;
  final int pendingCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Theme.of(context).colorScheme.primary.withValues(alpha: 0.9),
            Theme.of(context).colorScheme.secondary.withValues(alpha: 0.9),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.15),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Seguimiento en vivo',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Flujo basado en eventos, sin modo oscuro',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.white.withValues(alpha: 0.9),
                        ),
                  ),
                ],
              ),
              IconButton.filled(
                onPressed: onSimulate,
                icon: const Icon(Icons.flash_on_rounded),
                color: Theme.of(context).colorScheme.primary,
                style: IconButton.styleFrom(
                  backgroundColor: Colors.white,
                ),
                tooltip: 'Simular ráfaga de eventos',
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _ChipStat(
                label: 'Pendientes de aprobación',
                value: pendingCount.toString(),
                icon: Icons.verified_user_outlined,
              ),
              const SizedBox(width: 12),
              _ChipStat(
                label: 'SLA promedio',
                value: '3.2h',
                icon: Icons.timer_outlined,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ChipStat extends StatelessWidget {
  const _ChipStat({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            Icon(icon, color: Theme.of(context).colorScheme.primary),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                Text(
                  label,
                  style: TextStyle(
                    color: Colors.grey.shade600,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _WorkflowCard extends StatelessWidget {
  const _WorkflowCard({
    required this.item,
    this.onAdvance,
  });

  final WorkflowItem item;
  final VoidCallback? onAdvance;

  Color _statusColor(BuildContext context) {
    switch (item.estado) {
      case WorkflowStatus.pendiente:
        return Colors.orange.shade400;
      case WorkflowStatus.enProceso:
        return Colors.blue.shade400;
      case WorkflowStatus.produccion:
        return Colors.indigo.shade400;
      case WorkflowStatus.instalacion:
        return Colors.teal.shade400;
      case WorkflowStatus.finalizacion:
        return Colors.green.shade500;
    }
  }

  String _statusLabel() {
    switch (item.estado) {
      case WorkflowStatus.pendiente:
        return 'Pendiente';
      case WorkflowStatus.enProceso:
        return 'En Proceso';
      case WorkflowStatus.produccion:
        return 'Producción';
      case WorkflowStatus.instalacion:
        return 'Instalación';
      case WorkflowStatus.finalizacion:
        return 'Finalización';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.titulo,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${item.cliente} · ${item.ubicacion}',
                    style: TextStyle(color: Colors.grey.shade600),
                  ),
                ],
              ),
              Chip(
                label: Text(_statusLabel()),
                backgroundColor: _statusColor(context).withValues(alpha: 0.12),
                labelStyle: TextStyle(
                  color: _statusColor(context),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          LinearProgressIndicator(
            value: item.progreso / 100,
            minHeight: 8,
            borderRadius: BorderRadius.circular(20),
            color: Theme.of(context).colorScheme.primary,
            backgroundColor: Colors.grey.shade200,
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${item.progreso}%',
                style: TextStyle(color: Colors.grey.shade700),
              ),
              if (onAdvance != null)
                ElevatedButton.icon(
                  onPressed: onAdvance,
                  icon: const Icon(Icons.check_circle_outline, size: 18),
                  label: const Text('Solicitar avance'),
                ),
            ],
          ),
          if (item.observaciones.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(10),
              ),
              padding: const EdgeInsets.all(10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.error_outline, color: Colors.red.shade400),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: item.observaciones
                          .map((o) => Padding(
                                padding: const EdgeInsets.only(bottom: 4.0),
                                child: Text(
                                  o,
                                  style: TextStyle(color: Colors.red.shade700),
                                ),
                              ))
                          .toList(),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ApprovalsSection extends StatelessWidget {
  const _ApprovalsSection({
    required this.requests,
    required this.onApprove,
    required this.onReject,
  });

  final List<StateChangeRequest> requests;
  final void Function(String id, {String? note}) onApprove;
  final void Function(String id, String observation) onReject;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Aprobaciones del admin',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '${requests.length} pendientes',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (requests.isEmpty)
            Row(
              children: [
                Icon(Icons.inbox_outlined, color: Colors.grey.shade500),
                const SizedBox(width: 8),
                Text(
                  'Sin solicitudes pendientes',
                  style: TextStyle(color: Colors.grey.shade600),
                ),
              ],
            )
          else
            Column(
              children: requests
                  .map(
                    (r) => Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color:
                                  Theme.of(context).colorScheme.primary.withValues(alpha: 0.12),
                              shape: BoxShape.circle,
                            ),
                            child: Icon(
                              Icons.swap_horiz,
                              color: Theme.of(context).colorScheme.primary,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Cambio: ${r.from.name} → ${r.to.name}',
                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Solicitado por ${r.requestedBy}',
                                  style: TextStyle(color: Colors.grey.shade600),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            tooltip: 'Rechazar',
                            onPressed: () async {
                              final obs = await _showObservationDialog(context);
                              if (obs != null && obs.isNotEmpty) {
                                onReject(r.id, obs);
                              }
                            },
                            icon: const Icon(Icons.close_rounded, color: Colors.red),
                          ),
                          IconButton(
                            tooltip: 'Aprobar',
                            onPressed: () => onApprove(r.id),
                            icon: const Icon(Icons.check_circle, color: Colors.green),
                          ),
                        ],
                      ),
                    ),
                  )
                  .toList(),
            ),
        ],
      ),
    );
  }

  Future<String?> _showObservationDialog(BuildContext context) async {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Agregar observación'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(hintText: 'Detalle a corregir'),
          maxLines: 3,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('Rechazar con nota'),
          ),
        ],
      ),
    );
  }
}

class _TimelineSection extends ConsumerWidget {
  const _TimelineSection({required this.events});

  final List<AppEvent> events;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (events.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 10,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Row(
          children: [
            Icon(Icons.list_alt_outlined, color: Colors.grey.shade500),
            const SizedBox(width: 8),
            Text(
              'Aún no hay eventos en la sesión',
              style: TextStyle(color: Colors.grey.shade600),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Bitácora de eventos',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
          ),
          const SizedBox(height: 12),
          ...events.map(
            (e) => ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: CircleAvatar(
                radius: 16,
                backgroundColor:
                    Theme.of(context).colorScheme.primary.withValues(alpha: 0.12),
                child: Icon(
                  _eventIcon(e.type),
                  color: Theme.of(context).colorScheme.primary,
                  size: 18,
                ),
              ),
              title: Text(_eventTitle(e)),
              subtitle: Text(
                'Seq ${e.sequence} • ${e.createdAt.toLocal()}',
                style: TextStyle(color: Colors.grey.shade600),
              ),
            ),
          ),
        ],
      ),
    );
  }

  IconData _eventIcon(AppEventType type) {
    switch (type) {
      case AppEventType.stateChangeRequested:
        return Icons.outbox_rounded;
      case AppEventType.stateChangeApproved:
        return Icons.verified_rounded;
      case AppEventType.stateChangeRejected:
        return Icons.error_outline;
      case AppEventType.notificationDispatched:
        return Icons.notifications_active_outlined;
      case AppEventType.simulation:
        return Icons.bolt_rounded;
    }
  }

  String _eventTitle(AppEvent event) {
    switch (event.type) {
      case AppEventType.stateChangeRequested:
        return 'Solicitud: ${event.payload['from']} → ${event.payload['to']}';
      case AppEventType.stateChangeApproved:
        return 'Aprobado hacia ${event.payload['to']}';
      case AppEventType.stateChangeRejected:
        return 'Rechazado: ${event.payload['observation']}';
      case AppEventType.notificationDispatched:
        return 'Notificación enviada';
      case AppEventType.simulation:
        return event.payload['message'] as String? ?? 'Evento simulado';
    }
  }
}

class _StatusStepper extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final steps = [
      _StepData('Pendiente', 0),
      _StepData('En Proceso', 25),
      _StepData('Producción', 50),
      _StepData('Instalación', 75),
      _StepData('Finalización', 100),
    ];
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: steps
            .map(
              (s) => Column(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundColor:
                        Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
                    child: Text(
                      '${s.progress}%',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.primary,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    s.label,
                    style: TextStyle(
                      color: Colors.grey.shade700,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            )
            .toList(),
      ),
    );
  }
}

class _StepData {
  _StepData(this.label, this.progress);
  final String label;
  final int progress;
}
