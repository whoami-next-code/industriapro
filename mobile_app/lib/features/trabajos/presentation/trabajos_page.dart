import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:table_calendar/table_calendar.dart';

import '../../../core/debug/debug_logger.dart';
import '../providers/trabajos_providers.dart';
import 'widgets/trabajo_card.dart';
import '../../../domain/entities/trabajo.dart';

class TrabajosPage extends ConsumerStatefulWidget {
  const TrabajosPage({super.key});

  @override
  ConsumerState<TrabajosPage> createState() => _TrabajosPageState();
}

class _TrabajosPageState extends ConsumerState<TrabajosPage> {
  DateTime _focusedDay = DateTime.now();
  DateTime _selectedDay = DateTime.now();
  CalendarFormat _calendarFormat = CalendarFormat.month;
  String _searchQuery = '';
  String? _filterEstado;
  bool _showCalendar = true;
  bool _filterByDate = true;

  @override
  Widget build(BuildContext context) {
    final trabajosAsync = ref.watch(trabajosAsignadosProvider);

    debugLog(
      location: 'trabajos_page.dart:build',
      message: 'trabajos_build_render',
      data: {'stateType': '${trabajosAsync.runtimeType}'},
      hypothesisId: 'H3',
      runId: 'pre-fix-2',
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mis trabajos de hoy'),
        centerTitle: false,
        actions: [
          IconButton(
            icon: Icon(_showCalendar ? Icons.list : Icons.calendar_month),
            onPressed: () {
              setState(() {
                _showCalendar = !_showCalendar;
              });
            },
            tooltip: _showCalendar ? 'Ver lista' : 'Ver calendario',
          ),
          IconButton(
            icon: const Icon(Icons.report_gmailerrorred_outlined),
            onPressed: () => context.push('/reportes-tecnicos'),
            tooltip: 'Reporte técnico',
          ),
        ],
      ),
      body: SafeArea(
        child: trabajosAsync.when(
          data: (trabajos) {
            if (trabajos.isEmpty) {
              return _buildEmptyState(context);
            }

            // Filtrar trabajos según fecha seleccionada y otros filtros
            final trabajosFiltrados = _filterTrabajos(trabajos);
            final trabajosPorFecha = _groupTrabajosByDate(trabajos);

            final total = trabajosFiltrados.length;
            final enCurso = trabajosFiltrados
                .where((t) =>
                    t.estado.toUpperCase() == 'EN_PROCESO' ||
                    t.estado.toUpperCase() == 'PRODUCCION' ||
                    t.estado.toUpperCase() == 'INSTALACION')
                .length;
            final pendientes = trabajosFiltrados
                .where((t) => t.estado.toUpperCase() == 'PENDIENTE')
                .length;
            final atrasados = trabajosFiltrados
                .where(
                  (t) =>
                      t.fechaLimite != null &&
                      t.fechaLimite!.isBefore(DateTime.now()) &&
                      t.progreso < 100,
                )
                .length;

            return RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(trabajosAsignadosProvider);
              },
              child: ListView(
                padding: const EdgeInsets.only(bottom: 24),
                children: [
                  _buildProfessionalHeader(
                    context,
                    total,
                    enCurso,
                    pendientes,
                    atrasados,
                  ),
                  _buildSearchAndFilters(context),
                  const SizedBox(height: 8),
                  if (_showCalendar)
                    _buildCalendarSection(
                      context,
                      trabajosPorFecha,
                      trabajosFiltrados,
                    )
                  else
                    _buildListSection(context, trabajosFiltrados),
                ],
              ),
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => _buildErrorState(context, e, ref),
        ),
      ),
    );
  }

  List<Trabajo> _filterTrabajos(List<Trabajo> trabajos) {
    var filtered = trabajos;

    // Filtrar por búsqueda
    if (_searchQuery.isNotEmpty) {
      final query = _searchQuery.toLowerCase();
      filtered = filtered.where((t) {
        return t.codigo.toLowerCase().contains(query) ||
               t.cliente.toLowerCase().contains(query) ||
               t.equipo.toLowerCase().contains(query);
      }).toList();
    }

    // Filtrar por estado
    if (_filterEstado != null && _filterEstado!.isNotEmpty) {
      filtered = filtered.where((t) {
        return t.estado.toUpperCase() == _filterEstado!.toUpperCase();
      }).toList();
    }

    // Filtrar por fecha seleccionada
    if (_filterByDate) {
      filtered = filtered.where((t) {
        if (t.fechaLimite == null) return true;
        return _isSameDay(t.fechaLimite!, _selectedDay);
      }).toList();
    }

    return filtered;
  }

  Map<DateTime, List<Trabajo>> _groupTrabajosByDate(List<Trabajo> trabajos) {
    final Map<DateTime, List<Trabajo>> grouped = {};
    
    for (final trabajo in trabajos) {
      if (trabajo.fechaLimite != null) {
        final day = DateTime(
          trabajo.fechaLimite!.year,
          trabajo.fechaLimite!.month,
          trabajo.fechaLimite!.day,
        );
        grouped.putIfAbsent(day, () => []).add(trabajo);
      }
    }
    
    return grouped;
  }

  bool _isSameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  Widget _buildProfessionalHeader(
    BuildContext context,
    int total,
    int enCurso,
    int pendientes,
    int atrasados,
  ) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Theme.of(context).colorScheme.primary,
            Theme.of(context).colorScheme.secondary,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.3),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.work_outline, color: Colors.white, size: 28),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Resumen de Producción',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      DateFormat('EEEE, d MMMM yyyy', 'es').format(_selectedDay),
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.white.withValues(alpha: 0.9),
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: _buildStatCard(context, 'Trabajos hoy', total.toString(), Icons.assignment, Colors.white),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildStatCard(context, 'En curso', enCurso.toString(), Icons.timelapse, Colors.white),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildStatCard(context, 'Pendientes', pendientes.toString(), Icons.pending_actions, Colors.white),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildStatCard(context, 'Atrasados', atrasados.toString(), Icons.warning_amber_rounded, Colors.white),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard(BuildContext context, String label, String value, IconData icon, Color iconColor) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: iconColor),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  label,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.9),
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchAndFilters(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Card(
        elevation: 0,
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: Colors.grey.shade200),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              TextField(
                decoration: InputDecoration(
                  hintText: 'Buscar por código, cliente o equipo...',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: _searchQuery.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear),
                          onPressed: () {
                            setState(() {
                              _searchQuery = '';
                            });
                          },
                        )
                      : null,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  filled: true,
                  fillColor: Colors.grey.shade50,
                ),
                onChanged: (value) {
                  setState(() {
                    _searchQuery = value;
                  });
                },
              ),
              const SizedBox(height: 10),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildFilterChip(
                      _filterByDate ? 'Hoy' : 'Todas las fechas',
                      _filterByDate,
                      () {
                        setState(() {
                          _filterByDate = !_filterByDate;
                        });
                      },
                    ),
                    const SizedBox(width: 8),
                    _buildFilterChip('Todos', _filterEstado == null, () {
                      setState(() {
                        _filterEstado = null;
                      });
                    }),
                    const SizedBox(width: 8),
                    _buildFilterChip('Pendiente', _filterEstado == 'PENDIENTE', () {
                      setState(() {
                        _filterEstado = 'PENDIENTE';
                      });
                    }),
                    const SizedBox(width: 8),
                    _buildFilterChip('En Producción', _filterEstado == 'EN_PROCESO', () {
                      setState(() {
                        _filterEstado = 'EN_PROCESO';
                      });
                    }),
                    const SizedBox(width: 8),
                    _buildFilterChip('Instalación', _filterEstado == 'INSTALACION', () {
                      setState(() {
                        _filterEstado = 'INSTALACION';
                      });
                    }),
                    const SizedBox(width: 8),
                    _buildFilterChip('Finalizado', _filterEstado == 'FINALIZADO', () {
                      setState(() {
                        _filterEstado = 'FINALIZADO';
                      });
                    }),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, bool selected, VoidCallback onTap) {
    return FilterChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
      selectedColor: Theme.of(context).colorScheme.primaryContainer,
      checkmarkColor: Theme.of(context).colorScheme.onPrimaryContainer,
    );
  }

  Widget _buildCalendarSection(
    BuildContext context,
    Map<DateTime, List<Trabajo>> trabajosPorFecha,
    List<Trabajo> trabajosFiltrados,
  ) {
    return Column(
      children: [
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 10,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: TableCalendar<Trabajo>(
            firstDay: DateTime.utc(2020, 1, 1),
            lastDay: DateTime.utc(2030, 12, 31),
            focusedDay: _focusedDay,
            locale: 'es_ES',
            selectedDayPredicate: (day) => _isSameDay(day, _selectedDay),
            calendarFormat: _calendarFormat,
            availableCalendarFormats: const {
              CalendarFormat.month: 'Mes',
              CalendarFormat.twoWeeks: '2 semanas',
              CalendarFormat.week: 'Semana',
            },
            eventLoader: (day) {
              return trabajosPorFecha[day] ?? [];
            },
            startingDayOfWeek: StartingDayOfWeek.monday,
            calendarStyle: CalendarStyle(
              todayDecoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.5),
                shape: BoxShape.circle,
              ),
              selectedDecoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary,
                shape: BoxShape.circle,
              ),
              markerDecoration: BoxDecoration(
                color: Theme.of(context).colorScheme.secondary,
                shape: BoxShape.circle,
              ),
              outsideDaysVisible: false,
            ),
            headerStyle: HeaderStyle(
              formatButtonVisible: true,
              formatButtonShowsNext: false,
              formatButtonDecoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(8),
              ),
              formatButtonTextStyle: TextStyle(
                color: Theme.of(context).colorScheme.onPrimaryContainer,
              ),
            ),
            onDaySelected: (selectedDay, focusedDay) {
              setState(() {
                _selectedDay = selectedDay;
                _focusedDay = focusedDay;
              });
            },
            onFormatChanged: (format) {
              setState(() {
                _calendarFormat = format;
              });
            },
            onPageChanged: (focusedDay) {
              _focusedDay = focusedDay;
            },
          ),
        ),
        if (trabajosFiltrados.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            child: Column(
              children: [
                Icon(Icons.event_busy, size: 64, color: Colors.grey[300]),
                const SizedBox(height: 12),
                Text(
                  'No hay trabajos para esta fecha',
                  style: TextStyle(color: Colors.grey[600]),
                ),
                if (_filterByDate || _filterEstado != null || _searchQuery.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: () {
                      setState(() {
                        _filterByDate = false;
                        _filterEstado = null;
                        _searchQuery = '';
                      });
                    },
                    icon: const Icon(Icons.filter_alt_off),
                    label: const Text('Limpiar filtros'),
                  ),
                ],
              ],
            ),
          )
        else
          _buildListSection(context, trabajosFiltrados),
      ],
    );
  }

  Widget _buildListSection(BuildContext context, List<Trabajo> trabajos) {
    if (trabajos.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        child: Column(
          children: [
            Icon(Icons.search_off, size: 64, color: Colors.grey[300]),
            const SizedBox(height: 12),
            Text(
              'No se encontraron trabajos',
              style: TextStyle(color: Colors.grey[600]),
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      child: Column(
        children: [
          for (final trabajo in trabajos) ...[
            TrabajoCard(
              trabajo: trabajo,
              onTap: () => context.push('/cotizaciones/${trabajo.id}'),
            ),
            const SizedBox(height: 8),
            _buildActionButtons(context, trabajo),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }

  Widget _buildActionButtons(BuildContext context, Trabajo trabajo) {
    final estadoUpper = trabajo.estado.toUpperCase();
    
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        if (estadoUpper == 'PENDIENTE')
          FilledButton.icon(
            onPressed: () => context.push('/cotizaciones/${trabajo.id}'),
            icon: const Icon(Icons.play_arrow, size: 18),
            label: const Text('Iniciar trabajo'),
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            ),
          ),
        OutlinedButton.icon(
          onPressed: () => context.push('/cotizaciones/${trabajo.id}/avance'),
          icon: const Icon(Icons.update, size: 18),
          label: const Text('Registrar avance'),
          style: OutlinedButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          ),
        ),
        TextButton.icon(
          onPressed: () => context.push('/cotizaciones/${trabajo.id}'),
          icon: const Icon(Icons.visibility, size: 18),
          label: const Text('Ver detalle'),
          style: TextButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.work_outline,
            size: 80,
            color: Theme.of(context).colorScheme.outline,
          ),
          const SizedBox(height: 16),
          Text(
            'No hay trabajos asignados',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Cuando tengas trabajos, aparecerán aquí.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState(BuildContext context, Object error, WidgetRef ref) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: Theme.of(context).colorScheme.error,
            ),
            const SizedBox(height: 16),
            Text(
              'Error al cargar trabajos',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              error.toString(),
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () {
                ref.invalidate(trabajosAsignadosProvider);
              },
              icon: const Icon(Icons.refresh),
              label: const Text('Reintentar'),
            ),
          ],
        ),
      ),
    );
  }

  
}
