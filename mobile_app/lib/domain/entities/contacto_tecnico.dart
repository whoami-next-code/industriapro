class ContactoTecnico {
  const ContactoTecnico({
    required this.id,
    required this.nombre,
    required this.email,
    required this.telefono,
    required this.mensaje,
    required this.estado,
    required this.creadoEn,
  });

  final int id;
  final String nombre;
  final String email;
  final String telefono;
  final String mensaje;
  final String estado;
  final DateTime creadoEn;

  factory ContactoTecnico.fromJson(Map<String, dynamic> json) {
    return ContactoTecnico(
      id: json['id'] is int ? json['id'] as int : int.tryParse('${json['id']}') ?? 0,
      nombre: json['nombre']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      telefono: json['telefono']?.toString() ?? '',
      mensaje: json['mensaje']?.toString() ?? '',
      estado: json['estado']?.toString() ?? 'nuevo',
      creadoEn: DateTime.tryParse(json['creadoEn']?.toString() ?? '') ?? DateTime.now(),
    );
  }
}
