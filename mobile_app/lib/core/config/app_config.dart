import 'package:flutter/foundation.dart'
    show TargetPlatform, defaultTargetPlatform, kIsWeb, kReleaseMode;

class AppConfig {
  static const _prodFallbackBaseUrl = 'https://api.tu-dominio.com/api';

  static String _normalizeApiBaseUrl(String url) {
    final raw = url.trim();
    if (raw.isEmpty) return raw;

    try {
      var uri = Uri.parse(raw);

      if (!kReleaseMode) {
        final isLocalhost =
            uri.host == 'localhost' || uri.host == '127.0.0.1';
        if (isLocalhost && uri.hasPort && uri.port == 3000) {
          uri = uri.replace(port: 3001);
        }
      }

      var path = uri.path;
      if (!path.contains('/api')) {
        if (path.isEmpty || path == '/') {
          path = '/api';
        } else {
          final normalized = path.endsWith('/') ? path.substring(0, path.length - 1) : path;
          path = '$normalized/api';
        }
      }
      // Asegurar que el path no termine con barra (los paths siempre empezarán con /)
      if (path.endsWith('/') && path.length > 1) {
        path = path.substring(0, path.length - 1);
      }

      return uri.replace(path: path).toString();
    } catch (_) {
      return raw;
    }
  }

  /// Obtiene el baseUrl respetando overrides por entorno.
  /// - Dev: HTTP (localhost / 10.0.2.2) con prefijo /api.
  /// - Prod: HTTPS; usar --dart-define=API_BASE_URL=https://api.tu-dominio.com/api
  /// - Flutter Web: http://localhost:3001/api (dev)
  /// - Android emulador: http://10.0.2.2:3001/api (dev)
  /// - Otros: http://localhost:3001/api (dev)
  /// - Override: --dart-define=API_BASE_URL=http(s)://host:port/api
  static String get apiBaseUrl {
    const override = String.fromEnvironment('API_BASE_URL');
    if (override.isNotEmpty) return _normalizeApiBaseUrl(override);

    if (kReleaseMode) return _prodFallbackBaseUrl;

    if (kIsWeb) return _normalizeApiBaseUrl('http://localhost:3001/api');
    
    // Para desarrollo en dispositivo físico, usar la IP local de tu máquina
    // IP detectada automáticamente: 192.168.18.36
    // Si estás usando emulador Android, usa 10.0.2.2
    // Si estás usando dispositivo físico, usa tu IP local (ej. 192.168.1.X)
    
    // TODO: Cambiar esto según tu entorno (Emulador vs Dispositivo Físico)
    const bool usePhysicalDevice = true; 
    const String localIp = '192.168.18.36';
    
    if (defaultTargetPlatform == TargetPlatform.android) {
       return _normalizeApiBaseUrl(
        usePhysicalDevice 
          ? 'http://$localIp:3001/api' 
          : 'http://10.0.2.2:3001/api'
      );
    }
    
    return _normalizeApiBaseUrl('http://localhost:3001/api');
  }

  static String get backendUrl {
    final api = apiBaseUrl;
    // Si termina en /api, quitarlo.
    // Ojo: _normalizeApiBaseUrl asegura que termine en /api
    if (api.endsWith('/api')) {
      return api.substring(0, api.length - 4);
    }
    return api;
  }

  static String buildImageUrl(String? path) {
    if (path == null || path.isEmpty) {
      // Placeholder genérico si no hay imagen
      return 'https://via.placeholder.com/150?text=No+Image';
    }
    
    // Si es una URL absoluta, verificar si apunta a localhost y reescribirla si es necesario
    if (path.startsWith('http')) {
      // Si estamos en dispositivo Android (físico o emulador), localhost no funciona.
      // Reescribir localhost/127.0.0.1 al backendUrl configurado.
      if (path.contains('localhost') || path.contains('127.0.0.1')) {
        try {
          final uri = Uri.parse(path);
          final baseUri = Uri.parse(backendUrl);
          
          // Mantener el path y query, pero cambiar esquema, host y puerto
          return uri.replace(
            scheme: baseUri.scheme,
            host: baseUri.host,
            port: baseUri.port,
          ).toString();
        } catch (_) {
          // Si falla el parsing, retornar original
          return path;
        }
      }
      return path;
    }
    
    final base = backendUrl;
    final normalizedPath = path.startsWith('/') ? path : '/$path';
    return '$base$normalizedPath';
  }
}

