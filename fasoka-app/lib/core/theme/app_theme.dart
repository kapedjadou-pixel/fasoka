import 'package:flutter/material.dart';

/// Palette officielle Fasoka (voir identité visuelle)
class AppColors {
  static const Color noir = Color(0xFF0A0A0A);
  static const Color noirClair = Color(0xFF1B1A17);
  static const Color or = Color(0xFFFFC61E);
  static const Color orFonce = Color(0xFFB8860A);
  static const Color rouge = Color(0xFFE8352B);
  static const Color creme = Color(0xFFF5F3EE);
  static const Color grisTexte = Color(0xFF8A8A8A);
}

class AppTheme {
  static ThemeData get theme {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: AppColors.creme,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.or,
        primary: AppColors.or,
        secondary: AppColors.rouge,
        surface: Colors.white,
        brightness: Brightness.light,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.noir,
        foregroundColor: AppColors.or,
        elevation: 0,
        centerTitle: false,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.or,
          foregroundColor: AppColors.noir,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: AppColors.rouge,
        unselectedItemColor: AppColors.grisTexte,
        type: BottomNavigationBarType.fixed,
      ),
      cardTheme: CardThemeData(
        elevation: 1,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    );
  }
}
