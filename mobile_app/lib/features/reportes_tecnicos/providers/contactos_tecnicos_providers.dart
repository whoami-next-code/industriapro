import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/repositories/contactos_tecnicos_repository.dart';
import '../../../domain/entities/contacto_tecnico.dart';

final contactosTecnicosProvider =
    FutureProvider.autoDispose<List<ContactoTecnico>>((ref) async {
  final repo = ref.watch(contactosTecnicosRepositoryProvider);
  return repo.obtenerAsignados(forceRefresh: true);
});
