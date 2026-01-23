import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/repositories/trabajos_repository.dart';
import '../../../domain/entities/trabajo.dart';
import '../../cotizaciones/providers/cotizaciones_providers.dart';
import '../../auth/providers/auth_providers.dart';

final trabajosAsignadosProvider = FutureProvider<List<Trabajo>>((ref) async {
  final authState = ref.watch(authStateProvider);
  
  // Si es modo demo, retornar lista vacía (no hacer request protegida)
  if (authState.user?.id == 'demo' || authState.token == null || authState.token!.isEmpty) {
    return [];
  }

  try {
    // Usa cotizaciones (para técnicos) si el repo de trabajos falla o no existe.
    try {
      return await ref
          .watch(trabajosRepositoryProvider)
          .obtenerAsignados(forceRefresh: true);
    } catch (_) {
      return await ref.watch(cotizacionesProvider.future);
    }
  } catch (e) {
    // Si hay error 401, limpiar sesión y retornar lista vacía
    if (e.toString().contains('401') || e.toString().contains('No autenticado')) {
      ref.read(authControllerProvider.notifier).logout();
      return [];
    }
    rethrow;
  }
});

