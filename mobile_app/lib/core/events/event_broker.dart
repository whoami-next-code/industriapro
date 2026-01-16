import 'dart:async';
import 'dart:collection';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_event.dart';

/// Broker simple basado en colas para garantizar orden FIFO y broadcasting.
class EventBroker {
  EventBroker();

  final _queue = Queue<AppEvent>();
  final _controller = StreamController<AppEvent>.broadcast();
  bool _processing = false;
  int _sequence = 0;

  Stream<AppEvent> subscribe({AppEventType? type}) {
    return type == null
        ? _controller.stream
        : _controller.stream.where((event) => event.type == type);
  }

  /// Publica un evento, le asigna secuencia y lo despacha en orden.
  AppEvent publish(AppEvent event) {
    final sequenced = event.copyWith(sequence: ++_sequence);
    _queue.add(sequenced);
    _processQueue();
    return sequenced;
  }

  Future<void> _processQueue() async {
    if (_processing) return;
    _processing = true;
    while (_queue.isNotEmpty) {
      final event = _queue.removeFirst();
      _controller.add(event);
      // Pequeño delay opcional para simular red y permitir testear concurrencia.
      await Future<void>.delayed(const Duration(milliseconds: 5));
    }
    _processing = false;
  }

  Future<void> close() async {
    await _controller.close();
  }
}

final eventBrokerProvider = Provider<EventBroker>((ref) {
  final broker = EventBroker();
  ref.onDispose(broker.close);
  return broker;
});
