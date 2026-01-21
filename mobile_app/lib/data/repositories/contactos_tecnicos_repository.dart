import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/storage/cache_service.dart';
import '../../domain/entities/contacto_tecnico.dart';
import '../services/api_service.dart';

class ContactosTecnicosRepository {
  ContactosTecnicosRepository(this._api, this._cache);

  final ApiService _api;
  final CacheService _cache;
  static const String _cacheKey = 'contactos_tecnicos';
  static const Duration _cacheDuration = Duration(minutes: 5);

  Future<List<ContactoTecnico>> obtenerAsignados({bool forceRefresh = false}) async {
    if (!forceRefresh) {
      final cachedData = _cache.get(_cacheKey);
      if (cachedData != null) {
        final List<dynamic> jsonList = cachedData;
        return jsonList
            .map((json) =>
                ContactoTecnico.fromJson(json as Map<String, dynamic>))
            .toList();
      }
    }

    final response = await _api.get('contactos/asignados');
    final data = response.data as List<dynamic>? ?? [];
    await _cache.save(_cacheKey, data, expiration: _cacheDuration);
    return data
        .map((json) => ContactoTecnico.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  Future<List<String>> subirEvidencias(List<XFile> files) async {
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
      'contactos/adjuntos',
      data: formData,
      options: Options(contentType: 'multipart/form-data'),
    );
    final data = response.data as Map<String, dynamic>;
    return List<String>.from(data['urls'] ?? []);
  }

  Future<void> enviarReporte(int contactoId, Map<String, dynamic> data) async {
    await _api.post('contactos/$contactoId/reportes', data: data);
    await _cache.save(_cacheKey, null, expiration: Duration.zero);
  }
}

final contactosTecnicosRepositoryProvider =
    Provider<ContactosTecnicosRepository>(
  (ref) => ContactosTecnicosRepository(
    ref.watch(apiServiceProvider),
    ref.watch(cacheServiceProvider),
  ),
);
