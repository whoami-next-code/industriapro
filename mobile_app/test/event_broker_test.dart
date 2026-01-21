import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/core/events/app_event.dart';
import 'package:mobile_app/core/events/event_broker.dart';

void main() {
  group('EventBroker', () {
    test('mantiene el orden de publicación con concurrencia simulada', () async {
      final broker = EventBroker();
      final received = <AppEvent>[];
      final sub = broker.subscribe().listen(received.add);

      final random = Random();
      final futures = List.generate(6, (i) async {
        await Future<void>.delayed(Duration(milliseconds: random.nextInt(20)));
        broker.publish(
          AppEvent(type: AppEventType.simulation, payload: {'i': i}),
        );
      });

      await Future.wait(futures);
      await Future<void>.delayed(const Duration(milliseconds: 50));

      expect(received.length, 6);
      for (var i = 0; i < received.length; i++) {
        expect(received[i].sequence, i + 1);
      }

      await sub.cancel();
      await broker.close();
    });
  });
}
