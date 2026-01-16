import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../theme/app_theme.dart';

class ThemeState {
  final Color seedColor;

  const ThemeState({
    this.seedColor = AppTheme.defaultSeedColor,
  });

  ThemeState copyWith({
    Color? seedColor,
  }) {
    return ThemeState(
      seedColor: seedColor ?? this.seedColor,
    );
  }
}

class ThemeNotifier extends Notifier<ThemeState> {
  @override
  ThemeState build() {
    return const ThemeState();
  }

  void setSeedColor(Color color) {
    state = state.copyWith(seedColor: color);
  }
}

final themeProvider = NotifierProvider<ThemeNotifier, ThemeState>(ThemeNotifier.new);
