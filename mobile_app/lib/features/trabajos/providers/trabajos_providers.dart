import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/repositories/trabajos_repository.dart';
import '../../../domain/entities/trabajo.dart';
import '../../cotizaciones/providers/cotizaciones_providers.dart';
import '../../auth/providers/auth_providers.dart';
import '../../../core/network/socket_service.dart';

final trabajosAsignadosProvider = FutureProvider<List<Trabajo>>((ref) async {
  _setupTrabajosRealtimeSync(ref);
  final authState = ref.watch(authStateProvider);
  
  // Si es modo demo, retornar lista vacÃ­a (no hacer request protegida)
  if (authState.user?.id == 'demo' || authState.token == null || authState.token!.isEmpty) {
    return [];
  }

  try {
    // Usa cotizaciones (para tÃ©cnicos) si el repo de trabajos falla o no existe.
    try {
      return await ref
          .watch(trabajosRepositoryProvider)
          .obtenerAsignados(forceRefresh: true);
    } catch (_) {
      return await ref.watch(cotizacionesProvider.future);
    }
  } catch (e) {
    // Si hay error 401, limpiar sesiÃ³n y retornar lista vacÃ­a
    if (e.toString().contains('401') || e.toString().contains('No autenticado')) {
      ref.read(authControllerProvider.notifier).logout();
      return [];
    }
    rethrow;
  }
});




void _setupTrabajosRealtimeSync(Ref ref) {
  final authState = ref.watch(authStateProvider);
  if (authState.user?.id == 'demo' ||
      authState.token == null ||
      authState.token!.isEmpty) {
    return;
  }

  final socket = ref.watch(socketServiceProvider);

  void handler(dynamic _) {
    ref.invalidate(trabajosAsignadosProvider);
  }

  socket.listen('cotizaciones.updated', handler);
  ref.onDispose(() => socket.off('cotizaciones.updated', handler));
}


