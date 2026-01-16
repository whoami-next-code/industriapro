import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/app.dart';
import 'core/storage/cache_service.dart';
import 'core/notifications/push_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  final cacheService = CacheService();
  await cacheService.init();
  final pushService = PushService();
  await pushService.init();

  runApp(
    ProviderScope(
      overrides: [
        cacheServiceProvider.overrideWithValue(cacheService),
        pushServiceProvider.overrideWithValue(pushService),
      ],
      child: const App(),
    ),
  );
}
