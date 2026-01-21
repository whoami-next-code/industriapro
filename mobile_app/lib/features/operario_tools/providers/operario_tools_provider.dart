import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/storage/cache_service.dart';

class OperarioNote {
  OperarioNote({
    required this.id,
    required this.text,
    required this.createdAt,
    required this.tag,
  });

  final String id;
  final String text;
  final DateTime createdAt;
  final String tag;

  Map<String, dynamic> toJson() => {
        'id': id,
        'text': text,
        'createdAt': createdAt.toIso8601String(),
        'tag': tag,
      };

  factory OperarioNote.fromJson(Map<String, dynamic> json) {
    return OperarioNote(
      id: json['id']?.toString() ?? '',
      text: json['text']?.toString() ?? '',
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
      tag: json['tag']?.toString() ?? 'General',
    );
  }
}

class OperarioReport {
  OperarioReport({
    required this.id,
    required this.title,
    required this.detail,
    required this.type,
    required this.priority,
    required this.createdAt,
  });

  final String id;
  final String title;
  final String detail;
  final String type;
  final String priority;
  final DateTime createdAt;

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'detail': detail,
        'type': type,
        'priority': priority,
        'createdAt': createdAt.toIso8601String(),
      };

  factory OperarioReport.fromJson(Map<String, dynamic> json) {
    return OperarioReport(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      detail: json['detail']?.toString() ?? '',
      type: json['type']?.toString() ?? 'Incidencia',
      priority: json['priority']?.toString() ?? 'Media',
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }
}

class OperarioToolsState {
  const OperarioToolsState({
    required this.notes,
    required this.reports,
    required this.checklist,
    required this.isLoading,
  });

  final List<OperarioNote> notes;
  final List<OperarioReport> reports;
  final Map<String, bool> checklist;
  final bool isLoading;

  int get checklistCompleted =>
      checklist.values.where((value) => value).length;

  int get checklistTotal => checklist.length;

  OperarioToolsState copyWith({
    List<OperarioNote>? notes,
    List<OperarioReport>? reports,
    Map<String, bool>? checklist,
    bool? isLoading,
  }) {
    return OperarioToolsState(
      notes: notes ?? this.notes,
      reports: reports ?? this.reports,
      checklist: checklist ?? this.checklist,
      isLoading: isLoading ?? this.isLoading,
    );
  }

  factory OperarioToolsState.initial() {
    return const OperarioToolsState(
      notes: [],
      reports: [],
      checklist: {},
      isLoading: true,
    );
  }
}

class OperarioToolsController extends StateNotifier<OperarioToolsState> {
  OperarioToolsController(this._cache) : super(OperarioToolsState.initial()) {
    _loadFromCache();
  }

  static const String _notesKey = 'operario_notes';
  static const String _reportsKey = 'operario_reports';
  static const String _checklistKey = 'operario_checklist';

  static const List<String> defaultChecklistItems = [
    'EPP completo y en buen estado',
    'Area limpia y libre de riesgos',
    'Herramientas calibradas',
    'Maquinas con mantenimiento al dia',
    'Materiales revisados',
    'Plan de trabajo confirmado',
  ];

  final CacheService _cache;

  Future<void> _loadFromCache() async {
    final notesRaw = _cache.get(_notesKey);
    final reportsRaw = _cache.get(_reportsKey);
    final checklistRaw = _cache.get(_checklistKey);

    final notes = _parseNotes(notesRaw);
    final reports = _parseReports(reportsRaw);
    final checklist = _parseChecklist(checklistRaw);

    state = state.copyWith(
      notes: notes,
      reports: reports,
      checklist: checklist,
      isLoading: false,
    );
  }

  List<OperarioNote> _parseNotes(dynamic raw) {
    if (raw is List) {
      return raw
          .whereType<Map>()
          .map((item) => OperarioNote.fromJson(
                item.map((key, value) => MapEntry(key.toString(), value)),
              ))
          .toList()
          .reversed
          .toList();
    }
    return [];
  }

  List<OperarioReport> _parseReports(dynamic raw) {
    if (raw is List) {
      return raw
          .whereType<Map>()
          .map((item) => OperarioReport.fromJson(
                item.map((key, value) => MapEntry(key.toString(), value)),
              ))
          .toList()
          .reversed
          .toList();
    }
    return [];
  }

  Map<String, bool> _parseChecklist(dynamic raw) {
    if (raw is Map) {
      return raw.map((key, value) =>
          MapEntry(key.toString(), value == true));
    }
    return {for (final item in defaultChecklistItems) item: false};
  }

  Future<void> addNote({
    required String text,
    String tag = 'General',
  }) async {
    if (text.trim().isEmpty) return;
    final note = OperarioNote(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      text: text.trim(),
      createdAt: DateTime.now(),
      tag: tag,
    );
    final updated = [note, ...state.notes];
    state = state.copyWith(notes: updated);
    await _cache.save(
      _notesKey,
      updated.map((n) => n.toJson()).toList().reversed.toList(),
    );
  }

  Future<void> addReport({
    required String title,
    required String detail,
    required String type,
    required String priority,
  }) async {
    if (title.trim().isEmpty) return;
    final report = OperarioReport(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      title: title.trim(),
      detail: detail.trim(),
      type: type,
      priority: priority,
      createdAt: DateTime.now(),
    );
    final updated = [report, ...state.reports];
    state = state.copyWith(reports: updated);
    await _cache.save(
      _reportsKey,
      updated.map((r) => r.toJson()).toList().reversed.toList(),
    );
  }

  Future<void> toggleChecklist(String key) async {
    final updated = Map<String, bool>.from(state.checklist);
    updated[key] = !(updated[key] ?? false);
    state = state.copyWith(checklist: updated);
    await _cache.save(_checklistKey, updated);
  }

  Future<void> resetChecklist() async {
    final reset = {for (final item in defaultChecklistItems) item: false};
    state = state.copyWith(checklist: reset);
    await _cache.save(_checklistKey, reset);
  }
}

final operarioToolsProvider =
    StateNotifierProvider<OperarioToolsController, OperarioToolsState>((ref) {
  final cache = ref.watch(cacheServiceProvider);
  return OperarioToolsController(cache);
});
