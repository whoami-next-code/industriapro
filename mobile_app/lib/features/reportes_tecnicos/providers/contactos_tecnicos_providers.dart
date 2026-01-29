import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/repositories/contactos_tecnicos_repository.dart';
import '../../../domain/entities/contacto_tecnico.dart';
import '../../../core/network/socket_service.dart';

final contactosTecnicosProvider =
    FutureProvider.autoDispose<List<ContactoTecnico>>((ref) async {
  _setupContactosRealtimeSync(ref);
  final repo = ref.watch(contactosTecnicosRepositoryProvider);
  return repo.obtenerAsignados(forceRefresh: true);
});

void _setupContactosRealtimeSync(Ref ref) {
  final socket = ref.watch(socketServiceProvider);

  void handler(dynamic _) {
    ref.invalidate(contactosTecnicosProvider);
  }

  socket.listen('contactos.updated', handler);
  ref.onDispose(() => socket.off('contactos.updated', handler));
}

