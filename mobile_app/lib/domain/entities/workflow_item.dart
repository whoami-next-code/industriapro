enum WorkflowStatus {
  pendiente,
  enProceso,
  produccion,
  instalacion,
  finalizacion,
}

const Map<WorkflowStatus, int> workflowProgress = {
  WorkflowStatus.pendiente: 0,
  WorkflowStatus.enProceso: 25,
  WorkflowStatus.produccion: 50,
  WorkflowStatus.instalacion: 75,
  WorkflowStatus.finalizacion: 100,
};

class WorkflowItem {
  const WorkflowItem({
    required this.id,
    required this.titulo,
    required this.cliente,
    required this.ubicacion,
    required this.estado,
    this.observaciones = const [],
    this.lastUpdated,
  });

  final String id;
  final String titulo;
  final String cliente;
  final String ubicacion;
  final WorkflowStatus estado;
  final List<String> observaciones;
  final DateTime? lastUpdated;

  int get progreso => workflowProgress[estado] ?? 0;

  WorkflowItem copyWith({
    String? id,
    String? titulo,
    String? cliente,
    String? ubicacion,
    WorkflowStatus? estado,
    List<String>? observaciones,
    DateTime? lastUpdated,
  }) {
    return WorkflowItem(
      id: id ?? this.id,
      titulo: titulo ?? this.titulo,
      cliente: cliente ?? this.cliente,
      ubicacion: ubicacion ?? this.ubicacion,
      estado: estado ?? this.estado,
      observaciones: observaciones ?? this.observaciones,
      lastUpdated: lastUpdated ?? this.lastUpdated,
    );
  }
}
