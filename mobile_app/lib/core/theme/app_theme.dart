import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../debug/debug_logger.dart';

/// Tema único en modo claro inspirado en la UI de referencia.
class AppTheme {
  /// Color semilla alineado a una paleta industrial moderna.
  static const Color defaultSeedColor = Color(0xFF1F8EF1);

  /// Genera el tema claro de la aplicación.
  static ThemeData lightTheme({
    Color seedColor = defaultSeedColor,
  }) {
    // #region agent log
    debugLog(
      location: 'app_theme.dart:lightTheme',
      message: 'theme_generated_light_only',
      data: {
        'seedColor': seedColor.toARGB32().toRadixString(16),
        'font': 'DM Sans',
      },
      hypothesisId: 'H2',
      runId: 'pre-fix-2',
    );
    // #endregion

    final colorScheme = ColorScheme.fromSeed(seedColor: seedColor).copyWith(
      primary: seedColor,
      secondary: const Color(0xFF23B5B5),
      tertiary: const Color(0xFF7C5CFF),
      surface: const Color(0xFFF4F6FA),
      surfaceContainerHighest: const Color(0xFFE9EEF5),
      outline: const Color(0xFFD9E1EC),
    );

    final baseTheme = ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      brightness: Brightness.light,
      scaffoldBackgroundColor: const Color(0xFFF4F6FA),
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
        elevation: 1,
        color: Colors.white,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: colorScheme.outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: colorScheme.outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: colorScheme.primary, width: 1.5),
        ),
        labelStyle: GoogleFonts.dmSans(color: const Color(0xFF5B6B7A)),
        hintStyle: GoogleFonts.dmSans(color: const Color(0xFF9AA6B2)),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          backgroundColor: colorScheme.primary,
          foregroundColor: colorScheme.onPrimary,
          textStyle: GoogleFonts.dmSans(
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          side: BorderSide(color: colorScheme.outline),
          textStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w600),
        ),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: colorScheme.primary,
        foregroundColor: colorScheme.onPrimary,
        elevation: 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: colorScheme.primary,
        unselectedItemColor: Colors.grey,
        selectedLabelStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w600),
        unselectedLabelStyle: GoogleFonts.dmSans(),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: colorScheme.surfaceContainerHighest,
        labelStyle: GoogleFonts.dmSans(
          color: const Color(0xFF384454),
          fontWeight: FontWeight.w600,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        side: BorderSide(color: colorScheme.outline),
      ),
      dividerTheme: DividerThemeData(
        color: colorScheme.outline,
        thickness: 1,
        space: 24,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
    );

    // Aplica DM Sans a todo el texto
    return baseTheme.copyWith(
      textTheme: GoogleFonts.dmSansTextTheme(baseTheme.textTheme),
    );
  }
}
