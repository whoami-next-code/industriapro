import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../domain/entities/cotizacion_detalle.dart';
import '../../auth/providers/auth_providers.dart';
import '../../operario_tools/providers/operario_tools_provider.dart';
import '../providers/home_providers.dart';

class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authStateProvider).user;
    final statsAsync = ref.watch(homeStatsProvider);
    final recentAsync = ref.watch(recentCotizacionesProvider);
    final toolsState = ref.watch(operarioToolsProvider);

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildProfileHeader(
                          context,
                user?.name ?? 'Operario',
                user?.role ?? 'Producción',
                      ),
              const SizedBox(height: 20),
              _buildStatsHero(context, statsAsync),
              const SizedBox(height: 20),
              _buildQuickActions(context, ref),
              const SizedBox(height: 20),
              _buildChecklistCard(context, toolsState, ref),
              const SizedBox(height: 24),
              _buildRecentTasksHeader(context),
              const SizedBox(height: 12),
              recentAsync.when(
                data: (recientes) => recientes.isEmpty
                    ? _buildEmptyState()
                    : Column(
                        children: recientes
                            .map((c) => _buildTaskCard(context, c))
                            .toList(),
                      ),
                loading: () => const SizedBox(
                  height: 120,
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (_, __) => const SizedBox.shrink(),
              ),
              const SizedBox(height: 24),
              _buildOperarioNotes(context, toolsState, ref),
              const SizedBox(height: 20),
              _buildRecentReports(context, toolsState),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProfileHeader(BuildContext context, String name, String role) {
    return Row(
      children: [
        Container(
          width: 54,
          height: 54,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.primary,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color:
                    Theme.of(context).colorScheme.primary.withValues(alpha: 0.3),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Center(
            child: Text(
              name.isNotEmpty ? name.substring(0, 1).toUpperCase() : '?',
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
          ),
        ),
        const SizedBox(width: 16),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Hola, $name',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF0E2433),
                  ),
            ),
            Container(
              margin: const EdgeInsets.only(top: 4),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                role.toUpperCase(),
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF5B6B7A),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStatsHero(
      BuildContext context, AsyncValue<dynamic> statsAsync) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          colors: [
            Theme.of(context).colorScheme.primary.withValues(alpha: 0.92),
            Theme.of(context).colorScheme.secondary.withValues(alpha: 0.85),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.2),
            blurRadius: 16,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Panel operativo',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: Colors.white,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Resumen de tareas y seguimiento en tiempo real',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.white.withValues(alpha: 0.9),
                ),
          ),
          const SizedBox(height: 16),
          statsAsync.when(
            data: (stats) => Row(
              children: [
                _buildHeroStat(
                  context,
                  label: 'Asignados',
                  value: stats.total.toString(),
                  icon: Icons.assignment_turned_in,
                ),
                const SizedBox(width: 12),
                _buildHeroStat(
                  context,
                  label: 'En proceso',
                  value: stats.inProcess.toString(),
                  icon: Icons.timelapse,
                ),
              ],
            ),
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: LinearProgressIndicator(),
            ),
            error: (_, __) => Text(
              'No se pudo cargar el resumen',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.white.withValues(alpha: 0.9),
                  ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeroStat(
    BuildContext context, {
    required String label,
    required String value,
    required IconData icon,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.18),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Icon(icon, color: Colors.white),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                ),
                Text(
                  label,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.9),
                      ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActions(BuildContext context, WidgetRef ref) {
    final actions = [
      _QuickAction(
        label: 'Registrar avance',
        icon: Icons.update,
        color: Theme.of(context).colorScheme.tertiary,
        onTap: () => context.go('/request'),
      ),
      _QuickAction(
        label: 'Reporte técnico',
        icon: Icons.report_gmailerrorred_outlined,
        color: const Color(0xFFFF8F3D),
        onTap: () => context.go('/reportes-tecnicos'),
      ),
      _QuickAction(
        label: 'Bitácora de turno',
        icon: Icons.edit_note,
        color: const Color(0xFF2FB67C),
        onTap: () => _openNoteDialog(context, ref),
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Acciones rapidas',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.4,
          ),
          itemCount: actions.length,
          itemBuilder: (context, index) {
            final action = actions[index];
            return InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: action.onTap,
              child: Ink(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border:
                      Border.all(color: Theme.of(context).colorScheme.outline),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: action.color.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(action.icon, color: action.color),
                    ),
                    const Spacer(),
                    Text(
                      action.label,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildChecklistCard(
    BuildContext context,
    OperarioToolsState toolsState,
    WidgetRef ref,
  ) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Theme.of(context).colorScheme.outline),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              Icons.fact_check_outlined,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Checklist de seguridad',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${toolsState.checklistCompleted}/${toolsState.checklistTotal} completado',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: const Color(0xFF5B6B7A),
                      ),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: () => _showChecklistSheet(context, ref),
            child: const Text('Ver'),
          ),
        ],
      ),
    );
  }

  Widget _buildRecentTasksHeader(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          'Proximas tareas',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        TextButton(
          onPressed: () => context.go('/request'),
          child: const Text('Ver todas'),
        ),
      ],
    );
  }

  Widget _buildTaskCard(BuildContext context, CotizacionDetalle cotizacion) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Theme.of(context).colorScheme.outline),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            Icons.build_circle_outlined,
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
        title: Text(
          'Cotización #${cotizacion.code}',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: Text(
          cotizacion.need ?? cotizacion.notes ?? 'Sin detalle',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        trailing:
            const Icon(Icons.arrow_forward_ios, size: 14, color: Colors.grey),
        onTap: () => context.pushNamed(
          'cotizacion-detalle',
          pathParameters: {'id': cotizacion.id.toString()},
        ),
      ),
    );
  }

  Widget _buildOperarioNotes(
    BuildContext context,
    OperarioToolsState toolsState,
    WidgetRef ref,
  ) {
    final notes = toolsState.notes.take(3).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Bitácora de turno',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
            ),
            FilledButton.icon(
              onPressed: () => _openNoteDialog(context, ref),
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Agregar'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (notes.isEmpty)
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: Theme.of(context).colorScheme.outline),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(Icons.notes, color: Theme.of(context).colorScheme.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Sin notas registradas. Agrega novedades del turno.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: const Color(0xFF7C8CA3),
                        ),
                  ),
                ),
              ],
            ),
          )
        else
          Column(
            children: notes.map((note) {
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border:
                      Border.all(color: Theme.of(context).colorScheme.outline),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.04),
                      blurRadius: 10,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Theme.of(context)
                            .colorScheme
                            .secondary
                            .withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        Icons.notes,
                        size: 18,
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
                            '${note.tag} · ${_formatShortDate(note.createdAt)}',
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

  Widget _buildRecentReports(
      BuildContext context, OperarioToolsState toolsState) {
    final reports = toolsState.reports.take(3).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Reportes recientes',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
        const SizedBox(height: 8),
        if (reports.isEmpty)
          Text(
            'No hay reportes nuevos.',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: const Color(0xFF7C8CA3),
                ),
          )
        else
          Column(
            children: reports.map((report) {
              return Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border:
                      Border.all(color: Theme.of(context).colorScheme.outline),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFE8D6),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(
                        Icons.report_outlined,
                        size: 16,
                        color: Color(0xFFFF8F3D),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            report.title,
                            style: Theme.of(context)
                                .textTheme
                                .bodyMedium
                                ?.copyWith(fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${report.type} · ${report.priority}',
                            style: Theme.of(context)
                                .textTheme
                                .bodySmall
                                ?.copyWith(color: const Color(0xFF7C8CA3)),
                          ),
                        ],
                      ),
                    ),
                    Text(
                      _formatShortDate(report.createdAt),
                      style: Theme.of(context)
                          .textTheme
                          .bodySmall
                          ?.copyWith(color: const Color(0xFF7C8CA3)),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Container(
      padding: const EdgeInsets.all(32),
      alignment: Alignment.center,
      child: Column(
        children: [
          Icon(Icons.assignment_turned_in_outlined,
              size: 48, color: Colors.grey[300]),
          const SizedBox(height: 16),
          Text(
            'No tienes tareas asignadas',
            style: TextStyle(color: Colors.grey[500]),
          ),
        ],
      ),
    );
  }

  String _formatShortDate(DateTime date) {
    return DateFormat('dd/MM HH:mm').format(date);
  }

  Future<void> _openNoteDialog(BuildContext context, WidgetRef ref) async {
    final textController = TextEditingController();
    String tag = 'Turno';
    final result = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Row(
            children: const [
              Icon(Icons.edit_note),
              SizedBox(width: 8),
              Text('Nueva nota'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: textController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Detalle',
                  hintText: 'Registrar novedad, cambio o bloqueo',
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


  void _showChecklistSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) {
        final toolsState = ref.watch(operarioToolsProvider);
        return Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Checklist de seguridad',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                  ),
                  TextButton(
                    onPressed: () =>
                        ref.read(operarioToolsProvider.notifier).resetChecklist(),
                    child: const Text('Reiniciar'),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ...toolsState.checklist.keys.map((item) {
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
              }),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Cerrar'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _QuickAction {
  const _QuickAction({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
}
