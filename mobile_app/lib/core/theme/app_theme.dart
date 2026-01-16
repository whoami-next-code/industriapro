import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../debug/debug_logger.dart';

/// Tema único en modo claro inspirado en la UI de referencia.
class AppTheme {
  /// Color semilla alineado a la paleta turquesa del mock.
  static const Color defaultSeedColor = Color(0xFF14C9CB);

  /// Genera el tema claro de la aplicación.
  static ThemeData lightTheme({
    Color seedColor = defaultSeedColor,
  }) {
    // #region agent log
    debugLog(
      location: 'app_theme.dart:lightTheme',
      message: 'theme_generated_light_only',
      data: {
        'seedColor': seedColor.value.toRadixString(16),
        'font': 'DM Sans',
      },
      hypothesisId: 'H2',
      runId: 'pre-fix-2',
    );
    // #endregion

    final colorScheme = ColorScheme.fromSeed(seedColor: seedColor).copyWith(
      primary: seedColor,
      secondary: const Color(0xFF5AD2D4),
      surface: const Color(0xFFF6F8FB),
    );

    final baseTheme = ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      brightness: Brightness.light,
      scaffoldBackgroundColor: const Color(0xFFF3F7F9),
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0E2433),
        titleTextStyle: GoogleFonts.dmSans(
          color: const Color(0xFF0E2433),
          fontSize: 20,
          fontWeight: FontWeight.w700,
        ),
      ),
      cardTheme: CardThemeData(
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
        ),
        color: Colors.white,
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
        ),
        filled: true,
        fillColor: Colors.white,
        labelStyle: GoogleFonts.dmSans(),
        hintStyle: GoogleFonts.dmSans(),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 2,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          backgroundColor: colorScheme.primary,
          foregroundColor: colorScheme.onPrimary,
          textStyle: GoogleFonts.dmSans(
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: colorScheme.primary,
        foregroundColor: colorScheme.onPrimary,
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: colorScheme.primary,
        unselectedItemColor: Colors.grey,
        selectedLabelStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w600),
        unselectedLabelStyle: GoogleFonts.dmSans(),
      ),
    );

    // Aplica DM Sans a todo el texto
    return baseTheme.copyWith(
      textTheme: GoogleFonts.dmSansTextTheme(baseTheme.textTheme),
    );
  }
}
