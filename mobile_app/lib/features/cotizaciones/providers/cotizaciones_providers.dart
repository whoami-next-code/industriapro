import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/entities/cotizacion_detalle.dart';
import '../../../domain/entities/trabajo.dart';
import '../../../data/repositories/cotizaciones_repository.dart';
import '../../auth/providers/auth_providers.dart';
import '../../../core/network/socket_service.dart';

/// Lista de cotizaciones (usa el mismo endpoint que el admin)
final cotizacionesProvider = FutureProvider<List<Trabajo>>((ref) async {
  _setupCotizacionesRealtimeSync(ref);

  final authState = ref.watch(authStateProvider);
  if (authState.user?.id == 'demo' ||
      authState.token == null ||
      authState.token!.isEmpty) {
    return [];
  }

  final repo = ref.watch(cotizacionesRepositoryProvider);
  final role = authState.user?.role;
  final isClient = (role ?? '').toUpperCase() == 'CLIENTE';
  final data = isClient ? await repo.obtenerMias() : await repo.obtenerTodas();

  // Reusar entidad Trabajo para la lista (mantiene UI existente)
  return data
      .map(
        (c) => Trabajo(
          id: c.id.toString(),
          codigo: c.code,
          cliente: c.customerName,
          equipo: c.items.map((e) => e.productName ?? '').join(', '),
          estado: c.status,
          progreso: c.progressPercent,
          fechaLimite: c.estimatedDeliveryDate != null
              ? DateTime.tryParse(c.estimatedDeliveryDate!)
              : null,
        ),
      )
      .toList();
});

/// Detalle de cotización
final cotizacionDetalleProvider =
    FutureProvider.family<CotizacionDetalle, String>((ref, id) async {
  final authState = ref.watch(authStateProvider);
  if (authState.user?.id == 'demo' ||
      authState.token == null ||
      authState.token!.isEmpty) {
    throw Exception('No autenticado');
  }
  return ref.watch(cotizacionesRepositoryProvider).obtenerDetalle(id);
});

void _setupCotizacionesRealtimeSync(Ref ref) {
  final authState = ref.watch(authStateProvider);
  if (authState.user?.id == 'demo' ||
      authState.token == null ||
      authState.token!.isEmpty) {
    return;
  }

  final socket = ref.watch(socketServiceProvider);

  void handler(dynamic _) {
    ref.invalidate(cotizacionesProvider);
  }

  socket.listen('cotizaciones.updated', handler);
  ref.onDispose(() => socket.off('cotizaciones.updated', handler));
}

