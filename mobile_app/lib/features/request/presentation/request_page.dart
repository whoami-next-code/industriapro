import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../cotizaciones/providers/cotizaciones_pagination_provider.dart';
import '../../cotizaciones/presentation/widgets/cotizacion_card.dart';
import '../../../domain/entities/cotizaciones_filter.dart';
import '../../../core/ui/widgets/skeleton_loader.dart';

class RequestPage extends ConsumerStatefulWidget {
  const RequestPage({super.key});

  @override
  ConsumerState<RequestPage> createState() => _RequestPageState();
}

class _RequestPageState extends ConsumerState<RequestPage> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _tabController.addListener(_handleTabSelection);
    _scrollController.addListener(_onScroll);
    
    // Initial load
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(cotizacionesPaginationProvider.notifier).loadNextPage();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _scrollController.dispose();
    _searchController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _handleTabSelection() {
    if (_tabController.indexIsChanging) {
       _updateFilterStatus(_tabController.index);
    }
  }

  void _updateFilterStatus(int index) {
    String? status;
    switch (index) {
      case 1: status = 'PENDIENTE'; break;
      case 2: status = 'EN_PROCESO'; break;
      case 3: status = 'TERMINADO'; break; // Assuming backend uses TERMINADO or COMPLETADO
      default: status = null;
    }
    
    final notifier = ref.read(cotizacionesPaginationProvider.notifier);
    final currentFilter = ref.read(cotizacionesPaginationProvider).filter;
    
    if (currentFilter.status != status) {
        notifier.updateFilter(currentFilter.copyWith(status: status));
    }
  }

  void _onScroll() {
    if (_scrollController.hasClients && 
        _scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      ref.read(cotizacionesPaginationProvider.notifier).loadNextPage();
    }
  }

  void _onSearchChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () {
      final notifier = ref.read(cotizacionesPaginationProvider.notifier);
      final currentFilter = ref.read(cotizacionesPaginationProvider).filter;
      notifier.updateFilter(currentFilter.copyWith(searchQuery: query));
    });
  }

  void _showFilterModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => _FilterSheet(ref: ref),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(cotizacionesPaginationProvider);
    final pending = state.items
        .where((item) => item.status.toUpperCase() == 'PENDIENTE')
        .length;
    final inProcess = state.items
        .where((item) => item.status.toUpperCase() == 'EN_PROCESO')
        .length;
    final finished = state.items
        .where((item) => item.status.toUpperCase() == 'TERMINADO')
        .length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pedidos y cotizaciones'),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: const [
            Tab(text: 'Todos'),
            Tab(text: 'Pendientes'),
            Tab(text: 'En Proceso'),
            Tab(text: 'Terminados'),
          ],
          onTap: (index) {
              if (!_tabController.indexIsChanging) {
                  // Handle tap on same tab or if not animating
                   _updateFilterStatus(index);
              }
          },
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    decoration: const InputDecoration(
                      hintText: 'Buscar por numero o cliente',
                      prefixIcon: Icon(Icons.search),
                    ),
                    onChanged: _onSearchChanged,
                  ),
                ),
                const SizedBox(width: 12),
                IconButton.filledTonal(
                  onPressed: _showFilterModal,
                  icon: const Icon(Icons.filter_list),
                  tooltip: 'Filtros avanzados',
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Row(
              children: [
                _buildSummaryPill(
                  context,
                  label: 'Pendientes',
                  value: pending.toString(),
                  color: const Color(0xFFFFB54A),
                ),
                const SizedBox(width: 8),
                _buildSummaryPill(
                  context,
                  label: 'En proceso',
                  value: inProcess.toString(),
                  color: const Color(0xFF5CC8FF),
                ),
                const SizedBox(width: 8),
                _buildSummaryPill(
                  context,
                  label: 'Terminados',
                  value: finished.toString(),
                  color: const Color(0xFF56C98F),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: const SizedBox.shrink(),
          ),
          if (state.error != null && state.items.isEmpty)
             Expanded(
               child: Center(
                 child: Column(
                   mainAxisAlignment: MainAxisAlignment.center,
                   children: [
                     Text('Error: ${state.error}'),
                     ElevatedButton(
                      onPressed: () => ref
                          .read(cotizacionesPaginationProvider.notifier)
                          .refresh(),
                       child: const Text('Reintentar'),
                     ),
                   ],
                 ),
               ),
             )
          else 
            Expanded(
              child: RefreshIndicator(
                onRefresh: () => ref
                    .read(cotizacionesPaginationProvider.notifier)
                    .refresh(),
                child: state.items.isEmpty && state.isLoading
                    ? ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: 6,
                        itemBuilder: (context, index) =>
                            const CotizacionSkeletonCard(),
                      )
                    : state.items.isEmpty
                        ? const Center(
                            child: Text('No se encontraron cotizaciones'))
                        : ListView.builder(
                            controller: _scrollController,
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            itemCount:
                                state.items.length + (state.isLoading ? 1 : 0),
                            itemBuilder: (context, index) {
                              if (index == state.items.length) {
                                return const Center(
                                  child: Padding(
                                  padding: EdgeInsets.all(16.0),
                                  child: CircularProgressIndicator(),
                                  ),
                                );
                              }
                              
                              final item = state.items[index];
                              return CotizacionCard(
                                cotizacion: item,
                                onTap: () {
                                  context.pushNamed(
                                    'cotizacion-detalle',
                                    pathParameters: {'id': item.id.toString()},
                                  );
                                },
                              );
                            },
                          ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildSummaryPill(
    BuildContext context, {
    required String label,
    required String value,
    required Color color,
  }) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Theme.of(context).colorScheme.outline),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: color,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 6),
            Text(
              '$label $value',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FilterSheet extends StatefulWidget {
  final WidgetRef ref;
  const _FilterSheet({required this.ref});

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  DateTime? _startDate;
  DateTime? _endDate;
  final TextEditingController _minAmountCtrl = TextEditingController();
  final TextEditingController _maxAmountCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    final filter = widget.ref.read(cotizacionesPaginationProvider).filter;
    _startDate = filter.startDate;
    _endDate = filter.endDate;
    if (filter.minAmount != null) _minAmountCtrl.text = filter.minAmount.toString();
    if (filter.maxAmount != null) _maxAmountCtrl.text = filter.maxAmount.toString();
  }

  @override
  void dispose() {
    _minAmountCtrl.dispose();
    _maxAmountCtrl.dispose();
    super.dispose();
  }

  Future<void> _selectDate(bool isStart) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startDate = picked;
        } else {
          _endDate = picked;
        }
      });
    }
  }

  void _applyFilters() {
    final minAmount = double.tryParse(_minAmountCtrl.text);
    final maxAmount = double.tryParse(_maxAmountCtrl.text);
    
    final currentFilter = widget.ref.read(cotizacionesPaginationProvider).filter;
    widget.ref.read(cotizacionesPaginationProvider.notifier).updateFilter(
      currentFilter.copyWith(
        startDate: _startDate,
        endDate: _endDate,
        minAmount: minAmount,
        maxAmount: maxAmount,
      ),
    );
    Navigator.pop(context);
  }

  void _clearFilters() {
     final currentFilter = widget.ref.read(cotizacionesPaginationProvider).filter;
     // Keep status and search, clear others
     widget.ref.read(cotizacionesPaginationProvider.notifier).updateFilter(
       CotizacionesFilter(
           status: currentFilter.status,
           searchQuery: currentFilter.searchQuery,
       )
     );
     Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Filtros', style: Theme.of(context).textTheme.titleLarge),
              TextButton(onPressed: _clearFilters, child: const Text('Limpiar')),
            ],
          ),
          const SizedBox(height: 16),
          const Text('Rango de Fechas', style: TextStyle(fontWeight: FontWeight.bold)),
          Row(
            children: [
              Expanded(
                child: TextButton.icon(
                  onPressed: () => _selectDate(true),
                  icon: const Icon(Icons.calendar_today),
                  label: Text(_startDate == null ? 'Desde' : DateFormat('dd/MM/yyyy').format(_startDate!)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextButton.icon(
                  onPressed: () => _selectDate(false),
                  icon: const Icon(Icons.calendar_today),
                  label: Text(_endDate == null ? 'Hasta' : DateFormat('dd/MM/yyyy').format(_endDate!)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Text('Rango de Monto', style: TextStyle(fontWeight: FontWeight.bold)),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _minAmountCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Mínimo'),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: TextField(
                  controller: _maxAmountCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Máximo'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _applyFilters,
              child: const Text('Aplicar Filtros'),
            ),
          ),
        ],
      ),
    );
  }
}
