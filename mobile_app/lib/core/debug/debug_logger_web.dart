// ignore_for_file: avoid_web_libraries_in_flutter, deprecated_member_use
// #region agent log helper (Web)
import 'dart:convert';
import 'dart:html' as html;
import 'package:flutter/foundation.dart' show kReleaseMode;

/// Envía logs vía fetch al endpoint de debug mode (entornos Web).
/// No registrar secretos (contraseñas/tokens).
void debugLog({
  required String location,
  required String message,
  Map<String, dynamic>? data,
  String runId = 'run1',
  String hypothesisId = 'H-unknown',
}) {
  if (kReleaseMode) return;
  final payload = {
    'sessionId': 'debug-session',
    'runId': runId,
    'hypothesisId': hypothesisId,
    'location': location,
    'message': message,
    'data': data ?? <String, dynamic>{},
    'timestamp': DateTime.now().millisecondsSinceEpoch,
  };
  try {
    // ignore: unawaited_futures
    html
        .HttpRequest.request(
          'http://127.0.0.1:7242/ingest/638fba18-ebc9-4dbf-9020-8d680af003ce',
          method: 'POST',
          sendData: jsonEncode(payload),
          requestHeaders: {'Content-Type': 'application/json'},
        )
        .then((_) {})
        .catchError((_) {});
  } catch (_) {
    // No-op
  }
}
// #endregion

