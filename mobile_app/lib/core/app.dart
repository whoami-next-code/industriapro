import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'debug/debug_logger.dart';
import 'providers/theme_provider.dart';
import 'router/app_router.dart';
import 'theme/app_theme.dart';

class App extends ConsumerWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final GoRouter router = ref.watch(appRouterProvider);
    final themeState = ref.watch(themeProvider);

    // #region agent log
    debugLog(
      location: 'app.dart:build',
      message: 'app_build',
      data: {
        'routerHash': router.hashCode,
        'themeSeed': themeState.seedColor.toARGB32().toRadixString(16),
      },
      hypothesisId: 'H4',
      runId: 'pre-fix-2',
    );
    // #endregion

    return MaterialApp.router(
      title: 'Industria SP - Producción',
      theme: AppTheme.lightTheme(
        seedColor: themeState.seedColor,
      ),
      themeMode: ThemeMode.light,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}

