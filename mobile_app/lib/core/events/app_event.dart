import 'package:uuid/uuid.dart';

/// Tipos de evento que soporta el broker interno.
enum AppEventType {
  stateChangeRequested,
  stateChangeApproved,
  stateChangeRejected,
  notificationDispatched,
  simulation,
}

/// Representa un evento ordenado y trazable dentro de la app.
class AppEvent {
  AppEvent({
    required this.type,
    required this.payload,
    DateTime? createdAt,
    String? id,
    int? sequence,
  })  : id = id ?? const Uuid().v4(),
        createdAt = createdAt ?? DateTime.now(),
        sequence = sequence ?? 0;

  final String id;
  final AppEventType type;
  final Map<String, dynamic> payload;
  final DateTime createdAt;

  /// Secuencia monotónica asignada por el broker para garantizar el orden.
  final int sequence;

  AppEvent copyWith({
    String? id,
    AppEventType? type,
    Map<String, dynamic>? payload,
    DateTime? createdAt,
    int? sequence,
  }) {
    return AppEvent(
      id: id ?? this.id,
      type: type ?? this.type,
      payload: payload ?? this.payload,
      createdAt: createdAt ?? this.createdAt,
      sequence: sequence ?? this.sequence,
    );
  }
}
