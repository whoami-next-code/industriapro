import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../core/events/app_event.dart';
import '../../../core/events/event_broker.dart';
import '../../../core/notifications/push_service.dart';
import '../../../domain/entities/workflow_item.dart';

class StateChangeRequest {
  StateChangeRequest({
    required this.id,
    required this.itemId,
    required this.from,
    required this.to,
    required this.requestedBy,
    DateTime? requestedAt,
  }) : requestedAt = requestedAt ?? DateTime.now();

  final String id;
  final String itemId;
  final WorkflowStatus from;
  final WorkflowStatus to;
  final String requestedBy;
  final DateTime requestedAt;
}

class WorkflowStateData {
  const WorkflowStateData({
    required this.items,
    required this.pendingRequests,
    required this.timeline,
  });

  final List<WorkflowItem> items;
  final List<StateChangeRequest> pendingRequests;
  final List<AppEvent> timeline;

  WorkflowStateData copyWith({
    List<WorkflowItem>? items,
    List<StateChangeRequest>? pendingRequests,
    List<AppEvent>? timeline,
  }) {
    return WorkflowStateData(
      items: items ?? this.items,
      pendingRequests: pendingRequests ?? this.pendingRequests,
      timeline: timeline ?? this.timeline,
    );
  }
}

class WorkflowController extends Notifier<WorkflowStateData> {
  final _uuid = const Uuid();

  @override
  WorkflowStateData build() {
    final samples = [
      WorkflowItem(
        id: _uuid.v4(),
        titulo: 'Instalación de paneles acústicos',
        cliente: 'Café Central',
        ubicacion: 'Santiago, CL',
        estado: WorkflowStatus.enProceso,
        lastUpdated: DateTime.now().subtract(const Duration(hours: 2)),
      ),
      WorkflowItem(
        id: _uuid.v4(),
        titulo: 'Módulo de climatización',
        cliente: 'DataHub',
        ubicacion: 'CDMX, MX',
        estado: WorkflowStatus.produccion,
        lastUpdated: DateTime.now().subtract(const Duration(hours: 5)),
      ),
      WorkflowItem(
        id: _uuid.v4(),
        titulo: 'Sistema de racks livianos',
        cliente: 'LogiPack',
        ubicacion: 'Lima, PE',
        estado: WorkflowStatus.instalacion,
        lastUpdated: DateTime.now().subtract(const Duration(days: 1)),
        observaciones: const ['Verificar refuerzos en nivel 2'],
      ),
    ];

    return WorkflowStateData(
      items: samples,
      pendingRequests: const [],
      timeline: const [],
    );
  }

  WorkflowStatus? nextStatus(WorkflowStatus current) {
    final index = WorkflowStatus.values.indexOf(current);
    if (index == WorkflowStatus.values.length - 1) return null;
    return WorkflowStatus.values[index + 1];
  }

  Future<void> requestTransition(String itemId, WorkflowStatus target) async {
    final itemIndex = state.items.indexWhere((i) => i.id == itemId);
    if (itemIndex == -1) return;

    final item = state.items[itemIndex];
    if (workflowProgress[target]! <= workflowProgress[item.estado]!) return;

    final request = StateChangeRequest(
      id: _uuid.v4(),
      itemId: itemId,
      from: item.estado,
      to: target,
      requestedBy: 'operario',
    );

    _pushEvent(
      AppEventType.stateChangeRequested,
      {
        'itemId': itemId,
        'from': item.estado.name,
        'to': target.name,
      },
    );

    // Notificar al admin
    await ref.read(pushServiceProvider).notifyAdmin(
          title: 'Aprobación requerida',
          body: '${item.titulo}: ${_statusLabel(item.estado)} → ${_statusLabel(target)}',
        );

    state = state.copyWith(
      pendingRequests: [...state.pendingRequests, request],
    );
  }

  void approveRequest(String requestId, {String? note}) {
    final reqIndex = state.pendingRequests.indexWhere((r) => r.id == requestId);
    if (reqIndex == -1) return;
    final request = state.pendingRequests[reqIndex];
    final itemIndex = state.items.indexWhere((i) => i.id == request.itemId);
    if (itemIndex == -1) return;

    final item = state.items[itemIndex];
    final updatedItem = item.copyWith(
      estado: request.to,
      lastUpdated: DateTime.now(),
      observaciones: [
        ...item.observaciones,
        if (note != null && note.isNotEmpty) note,
      ],
    );

    _pushEvent(
      AppEventType.stateChangeApproved,
      {
        'itemId': item.id,
        'to': request.to.name,
        'note': note,
      },
    );

    final pending = [...state.pendingRequests]..removeAt(reqIndex);
    final items = [...state.items]..[itemIndex] = updatedItem;
    state = state.copyWith(items: items, pendingRequests: pending);
  }

  void rejectRequest(String requestId, String observation) {
    final reqIndex = state.pendingRequests.indexWhere((r) => r.id == requestId);
    if (reqIndex == -1) return;
    final request = state.pendingRequests[reqIndex];
    final itemIndex = state.items.indexWhere((i) => i.id == request.itemId);
    if (itemIndex == -1) return;

    final item = state.items[itemIndex];
    final updatedItem = item.copyWith(
      observaciones: [...item.observaciones, observation],
      lastUpdated: DateTime.now(),
    );

    _pushEvent(
      AppEventType.stateChangeRejected,
      {
        'itemId': item.id,
        'from': request.from.name,
        'to': request.to.name,
        'observation': observation,
      },
    );

    final pending = [...state.pendingRequests]..removeAt(reqIndex);
    final items = [...state.items]..[itemIndex] = updatedItem;
    state = state.copyWith(items: items, pendingRequests: pending);
  }

  /// Simula ráfagas de eventos concurrentes conservando orden secuencial.
  Future<void> simulateSequentialEvents() async {
    final random = Random();
    for (int i = 0; i < 4; i++) {
      await Future<void>.delayed(Duration(milliseconds: random.nextInt(20) + 5));
      final event = ref.read(eventBrokerProvider).publish(
            AppEvent(
              type: AppEventType.simulation,
              payload: {
                'message': 'Evento simulado #${i + 1}',
              },
            ),
          );
      state = state.copyWith(timeline: [...state.timeline, event]);
    }
  }

  void _pushEvent(AppEventType type, Map<String, dynamic> payload) {
    final broker = ref.read(eventBrokerProvider);
    final event = broker.publish(
      AppEvent(
        type: type,
        payload: payload,
      ),
    );

    state = state.copyWith(timeline: [...state.timeline, event]);
  }

  String _statusLabel(WorkflowStatus status) {
    switch (status) {
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
}

final workflowProvider =
    NotifierProvider<WorkflowController, WorkflowStateData>(WorkflowController.new);
