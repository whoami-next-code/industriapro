import 'package:flutter/foundation.dart' show debugPrint;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../config/app_config.dart';
import '../../features/auth/providers/auth_providers.dart';

final socketServiceProvider = Provider<SocketService>((ref) {
  final authState = ref.watch(authStateProvider);
  final service = SocketService(authState.token);
  service.connect();
  ref.onDispose(service.dispose);
  return service;
});

class SocketService {
  SocketService(this._token);

  final String? _token;
  io.Socket? _socket;

  String _buildSocketUrl() {
    final apiUrl = AppConfig.apiBaseUrl;
    final rootUrl = apiUrl.replaceFirst(RegExp(r'/api/?$'), '');
    return '$rootUrl/ws/admin';
  }

  void connect() {
    if ((_token ?? '').isEmpty) return;
    final socketUrl = _buildSocketUrl();

    _socket = io.io(
      socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setQuery({'token': _token})
          .enableAutoConnect()
          .enableReconnection()
          .enableForceNew()
          .build(),
    );

    _socket?.onConnect((_) => debugPrint('Socket conectado: $socketUrl'));
    _socket?.onDisconnect((reason) => debugPrint('Socket desconectado: $reason'));
    _socket?.onError((data) => debugPrint('Socket error: $data'));
    _socket?.on('connect_error', (data) => debugPrint('Socket connect_error: $data'));
  }

  void listen(String event, void Function(dynamic data) handler) {
    _socket?.on(event, handler);
  }

  void off(String event, [void Function(dynamic data)? handler]) {
    _socket?.off(event, handler);
  }

  void dispose() {
    _socket?.dispose();
    _socket = null;
  }
}

