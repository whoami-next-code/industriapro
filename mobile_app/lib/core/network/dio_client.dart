import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../debug/debug_logger.dart';
import '../storage/secure_storage.dart';

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
    ),
  );

  final storage = ref.watch(secureStorageProvider);

  Future<String?> refreshToken() async {
    final storedRefresh = await storage.read(key: 'refresh_token');
    if (storedRefresh == null || storedRefresh.isEmpty) return null;

    try {
      // Se usa un cliente limpio para evitar recursividad de interceptores.
      final refreshDio = Dio(
        BaseOptions(
          baseUrl: dio.options.baseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 20),
        ),
      );
      final response = await refreshDio.post(
        'auth/refresh',
        data: {'refresh_token': storedRefresh, 'refreshToken': storedRefresh},
      );

      final data = response.data as Map<String, dynamic>?;
      final newToken =
          (data?['access_token'] ?? data?['token'])?.toString();
      final newRefresh =
          (data?['refresh_token'] ?? data?['refreshToken'])?.toString();

      if (newToken != null && newToken.isNotEmpty) {
        await storage.write(key: 'token', value: newToken);
        if (newRefresh != null && newRefresh.isNotEmpty) {
          await storage.write(key: 'refresh_token', value: newRefresh);
        }
        debugLog(
          location: 'core/network/dio_client.dart:refreshToken',
          message: 'token refreshed',
          hypothesisId: 'H-refresh',
          data: {'hasRefresh': newRefresh?.isNotEmpty ?? false},
        );
        return newToken;
      }
    } catch (e) {
      debugLog(
        location: 'core/network/dio_client.dart:refreshToken',
        message: 'refresh_failed',
        hypothesisId: 'H-refresh',
        data: {'error': e.toString()},
      );
    }
    return null;
  }

  dio.interceptors.add(
    QueuedInterceptorsWrapper(
      onRequest: (options, handler) async {
        // Lista de endpoints que NO requieren autenticación
        final publicEndpoints = ['auth/login', 'auth/refresh'];
        final isPublicEndpoint = publicEndpoints.any(
          (endpoint) => options.path.contains(endpoint),
        );

        // Solo adjuntar token si NO es un endpoint público
        if (!isPublicEndpoint) {
          final token = await storage.read(key: 'token');
          if (token == null || token.isEmpty) {
            // Si no hay token y es un endpoint protegido, rechazar la request
            debugLog(
              location: 'core/network/dio_client.dart:onRequest',
              message: 'request_rejected_no_token',
              hypothesisId: 'H-auth-prevention',
              data: {'path': options.path},
            );
            return handler.reject(
              DioException(
                requestOptions: options,
                type: DioExceptionType.badResponse,
                response: Response(
                  requestOptions: options,
                  statusCode: 401,
                  statusMessage: 'No autenticado',
                ),
              ),
            );
          }
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        // Log detallado del error para diagnóstico de conexión
        debugLog(
          location: 'core/network/dio_client.dart:onError',
          message: 'api_request_failed',
          hypothesisId: 'H-network-debug',
          data: {
            'url': '${error.requestOptions.baseUrl}${error.requestOptions.path}',
            'method': error.requestOptions.method,
            'statusCode': error.response?.statusCode,
            'errorType': error.type.toString(),
            'message': error.message,
            'response': error.response?.data,
          },
        );

        final statusCode = error.response?.statusCode;
        final isAuthError = statusCode == 401;
        final alreadyRetried = error.requestOptions.extra['retried'] == true;

        if (isAuthError && !alreadyRetried) {
          // Intentar refrescar el token
          final newToken = await refreshToken();
          if (newToken != null && newToken.isNotEmpty) {
            final opts = error.requestOptions;
            opts.headers['Authorization'] = 'Bearer $newToken';
            opts.extra['retried'] = true;
            try {
              final cloneResponse = await dio.fetch(opts);
              return handler.resolve(cloneResponse);
            } catch (e) {
              debugLog(
                location: 'core/network/dio_client.dart:onError',
                message: 'retry_failed',
                hypothesisId: 'H-auth-retry',
                data: {'error': e.toString()},
              );
            }
          } else {
            // Si no se pudo refrescar, limpiar tokens y marcar como no autenticado
            debugLog(
              location: 'core/network/dio_client.dart:onError',
              message: 'auth_failed_clearing_tokens',
              hypothesisId: 'H-auth-cleanup',
            );
            await Future.wait([
              storage.delete(key: 'token'),
              storage.delete(key: 'refresh_token'),
            ]);
          }
        }
        return handler.next(error);
      },
    ),
  );

  return dio;
});

