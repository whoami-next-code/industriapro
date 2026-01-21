import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:path_provider/path_provider.dart';

enum Turno {
  manana('Mañana', '06:00 - 14:00'),
  tarde('Tarde', '14:00 - 22:00'),
  noche('Noche', '22:00 - 06:00');

  final String label;
  final String horario;
  
  const Turno(this.label, this.horario);
}

class ProfilePreferences {
  final String? profileImagePath;
  final Turno? turno;

  ProfilePreferences({
    this.profileImagePath,
    this.turno,
  });

  ProfilePreferences copyWith({
    String? profileImagePath,
    Turno? turno,
  }) {
    return ProfilePreferences(
      profileImagePath: profileImagePath ?? this.profileImagePath,
      turno: turno ?? this.turno,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'profileImagePath': profileImagePath,
      'turno': turno?.name,
    };
  }

  factory ProfilePreferences.fromJson(Map<String, dynamic> json) {
    return ProfilePreferences(
      profileImagePath: json['profileImagePath'] as String?,
      turno: json['turno'] != null
          ? Turno.values.firstWhere(
              (t) => t.name == json['turno'],
              orElse: () => Turno.manana,
            )
          : null,
    );
  }
}

class ProfilePreferencesNotifier extends StateNotifier<ProfilePreferences> {
  static const String _boxName = 'profile_preferences';
  late Box _box;

  ProfilePreferencesNotifier() : super(ProfilePreferences()) {
    _init();
  }

  Future<void> _init() async {
    try {
      _box = await Hive.openBox(_boxName);
      final data = _box.get('preferences');
      if (data != null) {
        state = ProfilePreferences.fromJson(Map<String, dynamic>.from(data));
      }
    } catch (_) {
      // Si no existe el box, crear uno nuevo
      _box = await Hive.openBox(_boxName);
    }
  }

  Future<void> updateProfileImage(String? imagePath) async {
    if (imagePath == null) {
      state = state.copyWith(profileImagePath: null);
      await _save();
      return;
    }

    final sourceFile = File(imagePath);
    if (!sourceFile.existsSync()) {
      return;
    }

    try {
      final appDir = await getApplicationDocumentsDirectory();
      final targetDir = Directory('${appDir.path}/profile');
      if (!targetDir.existsSync()) {
        targetDir.createSync(recursive: true);
      }

      final ext = imagePath.contains('.') ? imagePath.split('.').last : 'jpg';
      final fileName = 'avatar_${DateTime.now().millisecondsSinceEpoch}.$ext';
      final targetPath = '${targetDir.path}/$fileName';
      final savedFile = await sourceFile.copy(targetPath);

      final oldPath = state.profileImagePath;
      state = state.copyWith(profileImagePath: savedFile.path);
      await _save();

      if (oldPath != null && oldPath != savedFile.path) {
        final oldFile = File(oldPath);
        if (oldFile.existsSync()) {
          oldFile.deleteSync();
        }
      }
    } catch (_) {
      // Si falla el guardado, no actualizamos el estado para evitar rutas inválidas.
    }
  }

  Future<void> updateTurno(Turno turno) async {
    state = state.copyWith(turno: turno);
    await _save();
  }

  Future<void> _save() async {
    await _box.put('preferences', state.toJson());
  }
}

final profilePreferencesProvider =
    StateNotifierProvider<ProfilePreferencesNotifier, ProfilePreferences>(
  (ref) => ProfilePreferencesNotifier(),
);
