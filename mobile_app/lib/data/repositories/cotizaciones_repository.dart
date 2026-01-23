import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/storage/cache_service.dart';
import '../../domain/entities/cotizacion.dart';
import '../../domain/entities/cotizacion_detalle.dart';
import '../../domain/entities/cotizaciones_filter.dart';
import '../../domain/entities/cotizaciones_stats.dart';
import '../services/api_service.dart';

class CotizacionesRepository {
  CotizacionesRepository(this._api, this._cache);

  final ApiService _api;
  final CacheService _cache;
  static const String _listCacheKey = 'cotizaciones_list';
  static const Duration _cacheDuration = Duration(minutes: 5);

  Future<Map<String, dynamic>> crearCotizacion(Cotizacion cotizacion) async {
    final response = await _api.post(
      'cotizaciones',
      data: cotizacion.toJson(),
    );
    // Invalidate list cache when new item is created (clears all pages effectively if we use a prefix, but cache service is simple key-value)
    // Ideally we should clear all keys starting with cotizaciones_list, but CacheService might not support wildcard clear.
    // For now we just keep this, but it might only clear the base key if used without params.
    // A better approach for pagination cache invalidation is complex.
    await _cache.save(_listCacheKey, null, expiration: Duration.zero); 
    return response.data as Map<String, dynamic>;
  }

  Future<List<CotizacionDetalle>> obtenerTodas({
    bool forceRefresh = false,
    int page = 1,
    int limit = 20,
    CotizacionesFilter? filter,
  }) async {
    final cacheKey = '${_listCacheKey}_${page}_${limit}_${filter?.hashCode ?? 0}';

    if (!forceRefresh) {
      final cachedData = _cache.get(cacheKey);
      if (cachedData != null) {
        final List<dynamic> jsonList = cachedData;
        return jsonList
            .map((json) =>
                CotizacionDetalle.fromJson(json as Map<String, dynamic>))
            .toList();
      }
    }

    final queryParams = {
      'page': page,
      'limit': limit,
      ...?filter?.toQueryParameters(),
    };

    final response = await _api.get('cotizaciones', queryParameters: queryParams);
    
    List<dynamic> data;
    if (response.data is List) {
        data = response.data as List<dynamic>;
    } else if (response.data is Map && (response.data as Map).containsKey('data')) {
        data = (response.data as Map)['data'] as List<dynamic>;
    } else {
        data = [];
    }
    
    await _cache.save(cacheKey, data, expiration: _cacheDuration);

    return data
        .map((json) => CotizacionDetalle.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  Future<List<CotizacionDetalle>> obtenerMias({
    bool forceRefresh = false,
  }) async {
    const cacheKey = 'cotizaciones_mias';
    if (!forceRefresh) {
      final cachedData = _cache.get(cacheKey);
      if (cachedData != null) {
        final List<dynamic> jsonList = cachedData;
        return jsonList
            .map((json) =>
                CotizacionDetalle.fromJson(json as Map<String, dynamic>))
            .toList();
      }
    }

    final response = await _api.get('cotizaciones/mias');
    final data = response.data as List<dynamic>? ?? [];
    await _cache.save(cacheKey, data, expiration: _cacheDuration);
    return data
        .map((json) => CotizacionDetalle.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  Future<CotizacionDetalle> obtenerDetalle(String id, {bool forceRefresh = false}) async {
    final cacheKey = 'cotizacion_detail_$id';
    
    if (!forceRefresh) {
      final cachedData = _cache.get(cacheKey);
      if (cachedData != null) {
        if (cachedData is Map<String, dynamic>) {
          return CotizacionDetalle.fromJson(cachedData);
        }
        // Cache inválido: limpiar para forzar recarga
        await _cache.save(cacheKey, null, expiration: Duration.zero);
      }
    }

    final response = await _api.get('cotizaciones/$id');
    final raw = response.data;
    Map<String, dynamic>? data;

    if (raw is Map<String, dynamic>) {
      if (raw['data'] is Map) {
        data = Map<String, dynamic>.from(raw['data'] as Map);
      } else if (raw['cotizacion'] is Map) {
        data = Map<String, dynamic>.from(raw['cotizacion'] as Map);
      } else {
        data = raw;
      }
    } else if (raw is String) {
      // A veces el backend devuelve JSON como string o HTML en errores.
      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map<String, dynamic>) {
          if (decoded['data'] is Map) {
            data = Map<String, dynamic>.from(decoded['data'] as Map);
          } else if (decoded['cotizacion'] is Map) {
            data = Map<String, dynamic>.from(decoded['cotizacion'] as Map);
          } else {
            data = decoded;
          }
        }
      } catch (_) {
        // Ignorar, se lanzará error abajo
      }
    }

    if (data == null) {
      throw Exception('Respuesta inválida al cargar cotización');
    }
    
    await _cache.save(cacheKey, data, expiration: _cacheDuration);
    
    return CotizacionDetalle.fromJson(data);
  }

  Future<List<String>> subirAdjuntos(List<XFile> files) async {
    final formData = FormData();
    for (var file in files) {
      if (kIsWeb) {
        final bytes = await file.readAsBytes();
        formData.files.add(
          MapEntry(
            'files',
            MultipartFile.fromBytes(
              bytes,
              filename: file.name,
            ),
          ),
        );
      } else {
        formData.files.add(
          MapEntry(
            'files',
            await MultipartFile.fromFile(file.path),
          ),
        );
      }
    }
    
    final response = await _api.post(
      'cotizaciones/adjuntos',
      data: formData,
      options: Options(
        contentType: 'multipart/form-data',
      ),
    );
    
    final data = response.data as Map<String, dynamic>;
    return List<String>.from(data['urls']);
  }

  Future<void> agregarAvance(String id, Map<String, dynamic> data) async {
    await _api.post('cotizaciones/$id/avances', data: data);
    await _cache.save('cotizacion_detail_$id', null, expiration: Duration.zero);
  }

  Future<CotizacionesStats> obtenerEstadisticas() async {
    const cacheKey = 'cotizaciones_stats';
    
    final cachedData = _cache.get(cacheKey);
    if (cachedData != null) {
      return CotizacionesStats.fromJson(Map<String, dynamic>.from(cachedData));
    }

    try {
      final response = await _api.get(
        'cotizaciones',
        queryParameters: const {'page': 1, 'limit': 1},
      );
      final raw = response.data;
      if (raw is Map<String, dynamic> && raw['stats'] is Map) {
        final stats = Map<String, dynamic>.from(raw['stats'] as Map);
        final byStatus = Map<String, dynamic>.from(
          stats['byStatus'] as Map? ?? const {},
        );

        int countFor(List<String> keys) {
          return keys.fold<int>(0, (total, key) {
            final value = byStatus[key] ?? byStatus[key.toLowerCase()];
            if (value is num) return total + value.toInt();
            if (value is String) return total + (int.tryParse(value) ?? 0);
            return total;
          });
        }

        final normalized = {
          'total': stats['total'] ?? 0,
          'pending': countFor(['PENDIENTE', 'NUEVA']),
          'inProcess': countFor(['EN_PROCESO', 'PROCESANDO']),
          'completed': countFor(['COMPLETADO', 'FINALIZADA', 'TERMINADO']),
          'assignedToUser': 0,
          'userReportsCount': 0,
        };
        await _cache.save(cacheKey, normalized, expiration: _cacheDuration);
        return CotizacionesStats.fromJson(normalized);
      }
    } catch (e) {
      // Fallback: return empty stats or handle error
      return const CotizacionesStats();
    }
    return const CotizacionesStats();
  }
}

final cotizacionesRepositoryProvider = Provider<CotizacionesRepository>(
  (ref) => CotizacionesRepository(
    ref.watch(apiServiceProvider),
    ref.watch(cacheServiceProvider),
  ),
);

