class Producto {
  const Producto({
    required this.id,
    required this.nombre,
    this.precio,
    this.descripcion,
    this.imagen,
    this.stock,
  });

  final int id;
  final String nombre;
  final double? precio;
  final String? descripcion;
  final String? imagen;
  final int? stock;

  factory Producto.fromJson(Map<String, dynamic> json) {
    double? parsePrice(dynamic val) {
      if (val == null) return null;
      if (val is num) return val.toDouble();
      if (val is String) return double.tryParse(val);
      return null;
    }

    return Producto(
      id: (json['id'] as num).toInt(),
      nombre: json['nombre']?.toString() ?? json['name']?.toString() ?? '',
      precio: parsePrice(json['precio']) ?? parsePrice(json['price']),
      descripcion: json['descripcion']?.toString() ??
          json['description']?.toString(),
      imagen: json['imagen']?.toString() ?? 
              json['image']?.toString() ?? 
              json['imageUrl']?.toString() ??
              json['thumbnailUrl']?.toString(),
      stock: json['stock'] != null
          ? (json['stock'] as num).toInt()
          : json['quantity'] != null
              ? (json['quantity'] as num).toInt()
              : null,
    );
  }
}

