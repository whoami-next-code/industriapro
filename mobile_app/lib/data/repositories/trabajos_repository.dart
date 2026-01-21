import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/storage/cache_service.dart';
import '../../domain/entities/trabajo.dart';
import '../services/api_service.dart';

class TrabajosRepository {
  TrabajosRepository(this._api, this._cache);

  final ApiService _api;
  final CacheService _cache;
  static const String _cacheKey = 'trabajos_asignados';
  static const Duration _cacheDuration = Duration(minutes: 15);

  Future<List<Trabajo>> obtenerAsignados({bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cachedData = _cache.get(_cacheKey);
      if (cachedData != null) {
        final List<dynamic> jsonList = cachedData;
        return jsonList
            .map((json) => Trabajo.fromJson(json as Map<String, dynamic>))
            .toList();
      }
    }

    // Endpoint correcto para técnicos (evita 403 por roles en /cotizaciones).
    final response = await _api.get('trabajos/asignados');
    final data = response.data as List<dynamic>? ?? [];
    
    // Save to cache
    await _cache.save(_cacheKey, data, expiration: _cacheDuration);

    return data
        .map((json) => Trabajo.fromJson(json as Map<String, dynamic>))
        .toList();
  }
}

final trabajosRepositoryProvider = Provider<TrabajosRepository>(
  (ref) => TrabajosRepository(
    ref.watch(apiServiceProvider),
    ref.watch(cacheServiceProvider),
  ),
);

