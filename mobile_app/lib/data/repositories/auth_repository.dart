import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/storage/secure_storage.dart';
import '../../core/debug/debug_logger.dart';
import '../../domain/entities/user.dart';
import '../services/api_service.dart';

class AuthRepository {
  AuthRepository(this._api, this._secureStorage);

  final ApiService _api;
  final FlutterSecureStorage _secureStorage;

  Future<(User, String, String?, bool)> login({
    required String username,
    required String password,
  }) async {
    debugLog(
      location: 'data/repositories/auth_repository.dart:login',
      message: 'login_start',
      hypothesisId: 'H-credenciales',
      data: {'username': username},
    );

    try {
      final response = await _api.post(
        'auth/login',
        data: {
          'email': username,
          'password': password,
        },
      );

      final data = response.data as Map<String, dynamic>;
      final token = (data['access_token'] ?? data['token'])?.toString() ?? '';
      final refreshToken =
          (data['refresh_token'] ?? data['refreshToken'])?.toString();
      final userJson = (data['user'] as Map<String, dynamic>? ?? {});

      debugLog(
        location: 'data/repositories/auth_repository.dart:login',
        message: 'login_response',
        hypothesisId: 'H-credenciales',
        data: {
          'statusCode': response.statusCode,
          'hasToken': token.isNotEmpty,
          'userId': userJson['id'],
          'hasRefreshToken': (refreshToken?.isNotEmpty ?? false),
        },
      );

      if (token.isEmpty) {
        throw Exception('No se recibió token de autenticación');
      }

      await _secureStorage.write(key: 'token', value: token);
      if (refreshToken != null && refreshToken.isNotEmpty) {
        await _secureStorage.write(key: 'refresh_token', value: refreshToken);
      }

      final mustChangePassword =
          (data['mustChangePassword'] ?? data['must_change_password']) == true;
      return (User.fromJson(userJson), token, refreshToken, mustChangePassword);
    } on DioException catch (e) {
      // Manejo diferenciado de errores HTTP
      final statusCode = e.response?.statusCode;
      final errorMessage = e.response?.data?['message'] as String?;

      if (statusCode == 401) {
        throw Exception('Credenciales inválidas. Verifica tu email y contraseña.');
      } else if (statusCode == 400) {
        final message = errorMessage ?? 'Datos inválidos. Verifica el formato de tu email.';
        throw Exception(message);
      } else if (statusCode == 500) {
        throw Exception('Error del servidor. Por favor intenta más tarde.');
      } else if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        final url = '${e.requestOptions.baseUrl}${e.requestOptions.path}';
        throw Exception('Tiempo de espera agotado ($url). Verifica IP/Firewall.');
      } else if (e.type == DioExceptionType.connectionError) {
        final url = '${e.requestOptions.baseUrl}${e.requestOptions.path}';
        throw Exception('Error de conexión a $url. Verifica que el servidor esté corriendo y la IP sea accesible.');
      } else {
        throw Exception(errorMessage ?? 'Error al iniciar sesión. Por favor intenta nuevamente.');
      }
    } catch (e) {
      // Para cualquier otro error, lanzar mensaje amigable
      if (e is Exception) {
        rethrow;
      }
      throw Exception('Error inesperado al iniciar sesión. Por favor intenta nuevamente.');
    }
  }

  Future<String?> loadToken() => _secureStorage.read(key: 'token');

  Future<String?> loadRefreshToken() =>
      _secureStorage.read(key: 'refresh_token');

  Future<String> refreshToken() async {
    final storedRefresh = await loadRefreshToken();
    if (storedRefresh == null || storedRefresh.isEmpty) {
      throw Exception('No refresh token stored');
    }

    final response = await _api.post(
      'auth/refresh',
      data: {'refresh_token': storedRefresh, 'refreshToken': storedRefresh},
    );

    final data = response.data as Map<String, dynamic>;
    final newToken = (data['access_token'] ?? data['token'])?.toString() ?? '';
    final newRefresh =
        (data['refresh_token'] ?? data['refreshToken'])?.toString();

    debugLog(
      location: 'data/repositories/auth_repository.dart:refreshToken',
      message: 'refresh_response',
      hypothesisId: 'H-refresh',
      data: {
        'statusCode': response.statusCode,
        'hasToken': newToken.isNotEmpty,
        'hasRefreshToken': (newRefresh?.isNotEmpty ?? false),
      },
    );

    if (newToken.isEmpty) {
      throw Exception('No se pudo refrescar el token');
    }

    await _secureStorage.write(key: 'token', value: newToken);
    if (newRefresh != null && newRefresh.isNotEmpty) {
      await _secureStorage.write(key: 'refresh_token', value: newRefresh);
    }

    return newToken;
  }

  Future<void> changePasswordFirst(String newPassword) async {
    await _api.post(
      'auth/change-password-first',
      data: {'newPassword': newPassword},
    );
  }

  Future<void> logout() async {
    await Future.wait([
      _secureStorage.delete(key: 'token'),
      _secureStorage.delete(key: 'refresh_token'),
    ]);
  }
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    ref.watch(apiServiceProvider),
    ref.watch(secureStorageProvider),
  );
});

