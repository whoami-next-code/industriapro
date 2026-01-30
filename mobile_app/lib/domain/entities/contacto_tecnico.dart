class ReporteTecnico {
  const ReporteTecnico({
    required this.message,
    required this.createdAt,
    this.found,
    this.resolved,
    this.evidenceUrls = const [],
    this.technicianName,
  });

  final String message;
  final String? found;
  final String? resolved;
  final List<String> evidenceUrls;
  final DateTime createdAt;
  final String? technicianName;

  factory ReporteTecnico.fromJson(Map<String, dynamic> json) {
    return ReporteTecnico(
      message: json['message']?.toString() ?? '',
      found: json['found']?.toString(),
      resolved: json['resolved']?.toString(),
      evidenceUrls: (json['evidenceUrls'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
      technicianName: json['technicianName']?.toString(),
    );
  }
}

class ContactoTecnico {
  const ContactoTecnico({
    required this.id,
    required this.nombre,
    required this.email,
    required this.telefono,
    required this.mensaje,
    required this.estado,
    required this.creadoEn,
    this.reportes = const [],
  });

  final int id;
  final String nombre;
  final String email;
  final String telefono;
  final String mensaje;
  final String estado;
  final DateTime creadoEn;
  final List<ReporteTecnico> reportes;

  factory ContactoTecnico.fromJson(Map<String, dynamic> json) {
    final reportesRaw = json['reportes'];
    final reportes = reportesRaw is List
        ? reportesRaw
            .whereType<Map>()
            .map((r) => ReporteTecnico.fromJson(Map<String, dynamic>.from(r)))
            .toList()
        : const <ReporteTecnico>[];

    return ContactoTecnico(
      id: json['id'] is int ? json['id'] as int : int.tryParse('${json['id']}') ?? 0,
      nombre: json['nombre']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      telefono: json['telefono']?.toString() ?? '',
      mensaje: json['mensaje']?.toString() ?? '',
      estado: json['estado']?.toString() ?? 'nuevo',
      creadoEn: DateTime.tryParse(json['creadoEn']?.toString() ?? '') ?? DateTime.now(),
      reportes: reportes,
    );
  }
}
