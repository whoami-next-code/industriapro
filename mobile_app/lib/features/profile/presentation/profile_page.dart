import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../auth/providers/auth_providers.dart';
import '../../home/providers/home_providers.dart';
import '../../operario_tools/providers/operario_tools_provider.dart';
import '../providers/profile_provider.dart';

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final user = authState.user;
    final statsAsync = ref.watch(homeStatsProvider);
    final toolsState = ref.watch(operarioToolsProvider);
    final profilePrefs = ref.watch(profilePreferencesProvider);

    final reportesCount = statsAsync.maybeWhen(
      data: (stats) => stats.userReportsCount,
      orElse: () => 0,
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mi Perfil'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => _showLogoutDialog(context, ref),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        child: Column(
          children: [
            // Avatar con opción de editar
            Stack(
              children: [
                GestureDetector(
                  onTap: () => _showImagePicker(context, ref),
                  child: Container(
                    width: 120,
                    height: 120,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                      border: Border.all(
                        color: Theme.of(context).colorScheme.primary,
                        width: 3,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.1),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: ClipOval(
                      child: profilePrefs.profileImagePath != null &&
                              File(profilePrefs.profileImagePath!).existsSync()
                          ? Image.file(
                              File(profilePrefs.profileImagePath!),
                              fit: BoxFit.cover,
                              errorBuilder: (context, error, stackTrace) {
                                return _buildAvatarPlaceholder(context, user);
                              },
                            )
                          : _buildAvatarPlaceholder(context, user),
                    ),
                  ),
                ),
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: GestureDetector(
                    onTap: () => _showImagePicker(context, ref),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.primary,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                      child: const Icon(
                        Icons.camera_alt,
                        color: Colors.white,
                        size: 20,
                      ),
                  ),
                ),
              ),
              ],
            ),
            const SizedBox(height: 16),
            
            // Nombre y Rol
            Text(
              user?.name ?? 'Usuario Desconocido',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.grey[200],
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                user?.role.toUpperCase() ?? 'OPERARIO',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Colors.grey,
                ),
              ),
            ),
            const SizedBox(height: 32),

            _buildSummaryCard(
              context,
              reportesCount: reportesCount,
              notesCount: toolsState.notes.length,
              checklistDone: toolsState.checklistCompleted,
              checklistTotal: toolsState.checklistTotal,
            ),
            const SizedBox(height: 24),

            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () => _openNoteDialog(context, ref),
                    icon: const Icon(Icons.edit_note),
                    label: const Text('Nueva nota'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _openReportDialog(context, ref),
                    icon: const Icon(Icons.report_outlined),
                    label: const Text('Reporte técnico'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            _buildChecklistSection(context, toolsState, ref),
            const SizedBox(height: 24),

            _buildNotesSection(context, toolsState),
            const SizedBox(height: 24),

            // Detalles
            _buildInfoCard(
              context, 
              icon: Icons.email_outlined, 
              title: 'Correo Electrónico', 
              value: user?.email ?? 'No registrado',
            ),
            const SizedBox(height: 16),
            _buildTurnoCard(context, ref, profilePrefs),
            const SizedBox(height: 16),
            _buildInfoCard(
              context, 
              icon: Icons.history, 
              title: 'Reportes Realizados', 
              value: reportesCount.toString(),
            ),

            const SizedBox(height: 40),
            
            // Botón Cerrar Sesión
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => _showLogoutDialog(context, ref),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red[50],
                  foregroundColor: Colors.red,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                child: const Text('Cerrar Sesión'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAvatarPlaceholder(BuildContext context, user) {
    return Container(
      color: Theme.of(context).primaryColor.withValues(alpha: 0.1),
      child: Center(
        child: Text(
          user != null && user.name.trim().isNotEmpty
              ? user.name.trim().substring(0, 1).toUpperCase()
              : '?',
          style: TextStyle(
            fontSize: 48,
            fontWeight: FontWeight.bold,
            color: Theme.of(context).primaryColor,
          ),
        ),
      ),
    );
  }

  Future<void> _showImagePicker(BuildContext context, WidgetRef ref) async {
    final ImagePicker picker = ImagePicker();
    
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Elegir de galería'),
              onTap: () async {
                Navigator.pop(context);
                final XFile? image = await picker.pickImage(
                  source: ImageSource.gallery,
                  maxWidth: 800,
                  maxHeight: 800,
                  imageQuality: 85,
                );
                if (image != null && context.mounted) {
                  await ref
                      .read(profilePreferencesProvider.notifier)
                      .updateProfileImage(image.path);
                }
              },
            ),
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('Tomar foto'),
              onTap: () async {
                Navigator.pop(context);
                final XFile? image = await picker.pickImage(
                  source: ImageSource.camera,
                  maxWidth: 800,
                  maxHeight: 800,
                  imageQuality: 85,
                );
                if (image != null && context.mounted) {
                  await ref
                      .read(profilePreferencesProvider.notifier)
                      .updateProfileImage(image.path);
                }
              },
            ),
            if (ref.read(profilePreferencesProvider).profileImagePath != null)
              ListTile(
                leading: const Icon(Icons.delete, color: Colors.red),
                title: const Text('Eliminar foto', style: TextStyle(color: Colors.red)),
                onTap: () async {
                  Navigator.pop(context);
                  await ref
                      .read(profilePreferencesProvider.notifier)
                      .updateProfileImage(null);
                },
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildTurnoCard(
    BuildContext context,
    WidgetRef ref,
    ProfilePreferences prefs,
  ) {
    final turnoActual = prefs.turno ?? Turno.manana;

    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: InkWell(
        onTap: () => _showTurnoSelector(context, ref, turnoActual),
        borderRadius: BorderRadius.circular(12),
        child: ListTile(
          leading: Icon(Icons.access_time, color: Theme.of(context).primaryColor),
          title: const Text(
            'Turno',
            style: TextStyle(fontSize: 14, color: Colors.grey),
          ),
          subtitle: Text(
            '${turnoActual.label} (${turnoActual.horario})',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
          ),
          trailing: const Icon(Icons.edit, size: 20, color: Colors.grey),
        ),
      ),
    );
  }

  Future<void> _showTurnoSelector(
    BuildContext context,
    WidgetRef ref,
    Turno turnoActual,
  ) async {
    final result = await showDialog<Turno>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Seleccionar Turno'),
        content: RadioGroup<Turno>(
          groupValue: turnoActual,
          onChanged: (value) {
            if (value != null) {
              Navigator.of(context).pop(value);
            }
          },
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: Turno.values.map((turno) {
              return RadioListTile<Turno>(
                title: Text(turno.label),
                subtitle: Text(turno.horario),
                value: turno,
              );
            }).toList(),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancelar'),
          ),
        ],
      ),
    );

    if (result != null) {
      await ref.read(profilePreferencesProvider.notifier).updateTurno(result);
    }
  }

  Widget _buildSummaryCard(
    BuildContext context, {
    required int reportesCount,
    required int notesCount,
    required int checklistDone,
    required int checklistTotal,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Theme.of(context).colorScheme.outline),
      ),
      child: Row(
        children: [
          _buildSummaryItem(
            context,
            label: 'Reportes',
            value: reportesCount.toString(),
            icon: Icons.report_outlined,
          ),
          const SizedBox(width: 12),
          _buildSummaryItem(
            context,
            label: 'Notas',
            value: notesCount.toString(),
            icon: Icons.notes,
          ),
          const SizedBox(width: 12),
          _buildSummaryItem(
            context,
            label: 'Checklist',
            value: '$checklistDone/$checklistTotal',
            icon: Icons.fact_check_outlined,
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryItem(
    BuildContext context, {
    required String label,
    required String value,
    required IconData icon,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(icon, size: 18, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 6),
            Text(
              value,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            Text(
              label,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildChecklistSection(
    BuildContext context,
    OperarioToolsState toolsState,
    WidgetRef ref,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Checklist de seguridad',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Theme.of(context).colorScheme.outline),
          ),
          child: Column(
            children: toolsState.checklist.keys.map((item) {
              final done = toolsState.checklist[item] ?? false;
              return CheckboxListTile(
                value: done,
                onChanged: (_) => ref
                    .read(operarioToolsProvider.notifier)
                    .toggleChecklist(item),
                title: Text(item),
                controlAffinity: ListTileControlAffinity.leading,
                contentPadding: EdgeInsets.zero,
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildNotesSection(
    BuildContext context,
    OperarioToolsState toolsState,
  ) {
    final notes = toolsState.notes.take(4).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Bitácora del operario',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 8),
        if (notes.isEmpty)
          Text(
            'Sin notas recientes.',
            style: Theme.of(context)
                .textTheme
                .bodySmall
                ?.copyWith(color: const Color(0xFF7C8CA3)),
          )
        else
          Column(
            children: notes.map((note) {
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: Theme.of(context).colorScheme.outline),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Theme.of(context)
                            .colorScheme
                            .secondary
                            .withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(
                        Icons.notes,
                        size: 16,
                        color: Theme.of(context).colorScheme.secondary,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            note.text,
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            note.tag,
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: const Color(0xFF7C8CA3)),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
      ],
    );
  }

  Widget _buildInfoCard(BuildContext context,
      {required IconData icon, required String title, required String value}) {
    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: ListTile(
        leading: Icon(icon, color: Theme.of(context).primaryColor),
        title: Text(
          title,
          style: const TextStyle(fontSize: 14, color: Colors.grey),
        ),
        subtitle: Text(
          value,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
        ),
      ),
    );
  }

  void _showLogoutDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cerrar Sesión'),
        content: const Text('¿Estás seguro que deseas salir de la aplicación?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancelar'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(context).pop();
              ref.read(authControllerProvider.notifier).logout();
              context.go('/login');
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            child: const Text('Salir'),
          ),
        ],
      ),
    );
  }

  Future<void> _openNoteDialog(BuildContext context, WidgetRef ref) async {
    final textController = TextEditingController();
    String tag = 'Turno';
    final result = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Nueva nota'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: textController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Detalle',
                  hintText: 'Registrar novedad del turno',
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: tag,
                items: const [
                  DropdownMenuItem(value: 'Turno', child: Text('Turno')),
                  DropdownMenuItem(value: 'Proceso', child: Text('Proceso')),
                  DropdownMenuItem(
                      value: 'Mantenimiento', child: Text('Mantenimiento')),
                ],
                onChanged: (value) => tag = value ?? 'Turno',
                decoration: const InputDecoration(labelText: 'Categoría'),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Guardar'),
            ),
          ],
        );
      },
    );

    if (result == true && textController.text.trim().isNotEmpty) {
      await ref.read(operarioToolsProvider.notifier).addNote(
            text: textController.text,
            tag: tag,
          );
    }
  }

  Future<void> _openReportDialog(BuildContext context, WidgetRef ref) async {
    final titleController = TextEditingController();
    final detailController = TextEditingController();
    String type = 'Incidencia';
    String priority = 'Media';

    final result = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Nuevo reporte técnico'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: titleController,
                  decoration: const InputDecoration(
                    labelText: 'Título',
                    hintText: 'Ej. Ruido en motor principal',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: detailController,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Detalle',
                    hintText: 'Describe síntomas y urgencia',
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: type,
                  items: const [
                    DropdownMenuItem(
                        value: 'Incidencia', child: Text('Incidencia')),
                    DropdownMenuItem(
                        value: 'Soporte', child: Text('Soporte técnico')),
                    DropdownMenuItem(
                        value: 'Seguridad', child: Text('Seguridad')),
                  ],
                  onChanged: (value) => type = value ?? 'Incidencia',
                  decoration: const InputDecoration(labelText: 'Tipo'),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: priority,
                  items: const [
                    DropdownMenuItem(value: 'Alta', child: Text('Alta')),
                    DropdownMenuItem(value: 'Media', child: Text('Media')),
                    DropdownMenuItem(value: 'Baja', child: Text('Baja')),
                  ],
                  onChanged: (value) => priority = value ?? 'Media',
                  decoration: const InputDecoration(labelText: 'Prioridad'),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Guardar'),
            ),
          ],
        );
      },
    );

    if (result == true && titleController.text.trim().isNotEmpty) {
      await ref.read(operarioToolsProvider.notifier).addReport(
            title: titleController.text,
            detail: detailController.text,
            type: type,
            priority: priority,
          );
    }
  }
}
