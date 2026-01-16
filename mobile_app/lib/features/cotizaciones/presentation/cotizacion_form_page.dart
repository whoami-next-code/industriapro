import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/ui/inputs/custom_text_field.dart';
import '../../../core/ui/layout/responsive_layout.dart';
import '../../../core/config/app_config.dart';
import '../../../data/repositories/cotizaciones_repository.dart';
import '../../../data/repositories/productos_repository.dart';
import '../../../domain/entities/cotizacion.dart';
import '../../../domain/entities/producto.dart';

class CotizacionFormPage extends ConsumerStatefulWidget {
  const CotizacionFormPage({super.key});

  @override
  ConsumerState<CotizacionFormPage> createState() =>
      _CotizacionFormPageState();
}

class _CotizacionFormPageState extends ConsumerState<CotizacionFormPage> {
  final _formKey = GlobalKey<FormState>();
  final _nombreCtrl = TextEditingController();
  final _telefonoCtrl = TextEditingController();
  final _empresaCtrl = TextEditingController();
  final _documentoCtrl = TextEditingController();
  final _direccionCtrl = TextEditingController();
  final _necesidadCtrl = TextEditingController();
  final _notasCtrl = TextEditingController();
  final _presupuestoCtrl = TextEditingController();

  bool _loading = false;
  bool _loadingProductos = true;
  List<Producto> _productos = [];
  final Map<int, int> _productosSeleccionados = {}; // productId -> cantidad

  @override
  void initState() {
    super.initState();
    _cargarProductos();
  }

  Future<void> _cargarProductos() async {
    try {
      final productos = await ref.read(productosRepositoryProvider).obtenerProductos();
      setState(() {
        _productos = productos;
        _loadingProductos = false;
      });
    } catch (e) {
      setState(() {
        _loadingProductos = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error cargando productos: $e')),
        );
      }
    }
  }

  @override
  void dispose() {
    _nombreCtrl.dispose();
    _telefonoCtrl.dispose();
    _empresaCtrl.dispose();
    _documentoCtrl.dispose();
    _direccionCtrl.dispose();
    _necesidadCtrl.dispose();
    _notasCtrl.dispose();
    _presupuestoCtrl.dispose();
    super.dispose();
  }

  Future<void> _crearCotizacion() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    if (_productosSeleccionados.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Debe seleccionar al menos un producto'),
        ),
      );
      return;
    }

    setState(() {
      _loading = true;
    });

    try {
      final items = _productosSeleccionados.entries
          .map((entry) {
            final producto = _productos.firstWhere((p) => p.id == entry.key);
            return CotizacionItem(
              productId: entry.key,
              quantity: entry.value,
              productName: producto.nombre,
            );
          })
          .toList();

      final cotizacion = Cotizacion(
        customerName: _nombreCtrl.text.trim(),
        need: _necesidadCtrl.text.trim(),
        items: items,
        customerPhone: _telefonoCtrl.text.trim().isEmpty
            ? null
            : _telefonoCtrl.text.trim(),
        customerCompany: _empresaCtrl.text.trim().isEmpty
            ? null
            : _empresaCtrl.text.trim(),
        customerDocument: _documentoCtrl.text.trim().isEmpty
            ? null
            : _documentoCtrl.text.trim(),
        customerAddress: _direccionCtrl.text.trim().isEmpty
            ? null
            : _direccionCtrl.text.trim(),
        notes: _notasCtrl.text.trim().isEmpty
            ? null
            : _notasCtrl.text.trim(),
        budget: _presupuestoCtrl.text.trim().isEmpty
            ? null
            : double.tryParse(_presupuestoCtrl.text.trim()),
        preferredChannel: 'WHATSAPP',
      );

      await ref.read(cotizacionesRepositoryProvider).crearCotizacion(cotizacion);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Cotización creada exitosamente'),
            backgroundColor: Colors.green,
          ),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error al crear cotización: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  void _agregarProducto(Producto producto) {
    showDialog(
      context: context,
      builder: (context) => _CantidadDialog(
        producto: producto,
        onConfirm: (cantidad) {
          setState(() {
            _productosSeleccionados[producto.id] = cantidad;
          });
        },
      ),
    );
  }

  void _editarCantidad(Producto producto) {
    final cantidadActual = _productosSeleccionados[producto.id] ?? 1;
    showDialog(
      context: context,
      builder: (context) => _CantidadDialog(
        producto: producto,
        cantidadInicial: cantidadActual,
        onConfirm: (cantidad) {
          setState(() {
            _productosSeleccionados[producto.id] = cantidad;
          });
        },
        onDelete: () {
          setState(() {
            _productosSeleccionados.remove(producto.id);
          });
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Nueva Cotización'),
        elevation: 0,
      ),
      body: Form(
        key: _formKey,
        child: ResponsiveLayout(
          mobile: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _buildClientInfo(),
              const SizedBox(height: 16),
              _buildNeedInfo(),
              const SizedBox(height: 16),
              _buildProducts(),
              const SizedBox(height: 16),
              _buildAdditionalInfo(),
              const SizedBox(height: 24),
              _buildSubmitButton(),
            ],
          ),
          tablet: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 5,
                      child: Column(
                        children: [
                          _buildClientInfo(),
                          const SizedBox(height: 24),
                          _buildNeedInfo(),
                          const SizedBox(height: 24),
                          _buildAdditionalInfo(),
                        ],
                      ),
                    ),
                    const SizedBox(width: 24),
                    Expanded(
                      flex: 4,
                      child: Column(
                        children: [
                          _buildProducts(),
                          const SizedBox(height: 24),
                          _buildSubmitButton(),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          desktop: SingleChildScrollView(
            padding: const EdgeInsets.all(32),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 4,
                  child: Column(
                    children: [
                      _buildClientInfo(),
                      const SizedBox(height: 24),
                      _buildNeedInfo(),
                      const SizedBox(height: 24),
                      _buildAdditionalInfo(),
                    ],
                  ),
                ),
                const SizedBox(width: 32),
                Expanded(
                  flex: 5,
                  child: Column(
                    children: [
                      _buildProducts(),
                      const SizedBox(height: 32),
                      _buildSubmitButton(),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildClientInfo() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Información del Cliente',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            CustomTextField(
              label: 'Nombre completo *',
              controller: _nombreCtrl,
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'El nombre es requerido';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            CustomTextField(
              label: 'Teléfono',
              controller: _telefonoCtrl,
              keyboardType: TextInputType.phone,
            ),
            const SizedBox(height: 12),
            CustomTextField(
              label: 'Empresa',
              controller: _empresaCtrl,
            ),
            const SizedBox(height: 12),
            CustomTextField(
              label: 'Documento (DNI/RUC)',
              controller: _documentoCtrl,
            ),
            const SizedBox(height: 12),
            CustomTextField(
              label: 'Dirección',
              controller: _direccionCtrl,
              maxLines: 2,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNeedInfo() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Descripción de la Necesidad',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            CustomTextField(
              label: 'Describe lo que necesitas *',
              controller: _necesidadCtrl,
              hint: 'Ej: Necesito una estructura metálica para...',
              maxLines: 4,
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'La descripción es requerida';
                }
                return null;
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProducts() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Productos',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                if (_loadingProductos)
                  const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            if (_productosSeleccionados.isNotEmpty) ...[
              ..._productosSeleccionados.entries.map((entry) {
                final producto = _productos.firstWhere(
                  (p) => p.id == entry.key,
                );
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  color: Colors.blue.shade50,
                  child: ListTile(
                    title: Text(producto.nombre),
                    subtitle: Text('Cantidad: ${entry.value}'),
                    trailing: IconButton(
                      icon: const Icon(Icons.edit),
                      onPressed: () => _editarCantidad(producto),
                    ),
                  ),
                );
              }),
              const SizedBox(height: 8),
            ],
            if (_loadingProductos)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: CircularProgressIndicator(),
                ),
              )
            else if (_productos.isEmpty)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('No hay productos disponibles'),
              )
            else
              ..._productos
                  .where((p) => !_productosSeleccionados.containsKey(p.id))
                  .map((producto) => Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          leading: producto.imagen != null
                              ? ClipRRect(
                                  borderRadius: BorderRadius.circular(4),
                                  child: Image.network(
                                    AppConfig.buildImageUrl(producto.imagen),
                                    width: 50,
                                    height: 50,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) =>
                                        const Icon(Icons.image_not_supported),
                                  ),
                                )
                              : const Icon(Icons.category),
                          title: Text(producto.nombre),
                          subtitle: producto.precio != null
                              ? Text(
                                  'Precio: \$${producto.precio!.toStringAsFixed(2)}')
                              : null,
                          trailing: const Icon(Icons.add),
                          onTap: () => _agregarProducto(producto),
                        ),
                      )),
          ],
        ),
      ),
    );
  }

  Widget _buildAdditionalInfo() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Información Adicional',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            CustomTextField(
              label: 'Presupuesto estimado',
              controller: _presupuestoCtrl,
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.allow(
                  RegExp(r'^\d+\.?\d{0,2}'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            CustomTextField(
              label: 'Notas adicionales',
              controller: _notasCtrl,
              maxLines: 3,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSubmitButton() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: _loading ? null : _crearCotizacion,
        style: ElevatedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 16),
          backgroundColor: Theme.of(context).primaryColor,
          foregroundColor: Colors.white,
        ),
        child: _loading
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              )
            : const Text(
                'Crear Cotización',
                style: TextStyle(fontSize: 16),
              ),
      ),
    );
  }
}

class _CantidadDialog extends StatefulWidget {
  const _CantidadDialog({
    required this.producto,
    required this.onConfirm,
    this.cantidadInicial = 1,
    this.onDelete,
  });

  final Producto producto;
  final int cantidadInicial;
  final void Function(int) onConfirm;
  final VoidCallback? onDelete;

  @override
  State<_CantidadDialog> createState() => _CantidadDialogState();
}

class _CantidadDialogState extends State<_CantidadDialog> {
  late final TextEditingController _cantidadCtrl;

  @override
  void initState() {
    super.initState();
    _cantidadCtrl = TextEditingController(
      text: widget.cantidadInicial.toString(),
    );
  }

  @override
  void dispose() {
    _cantidadCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.producto.nombre),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CustomTextField(
            label: 'Cantidad',
            controller: _cantidadCtrl,
            keyboardType: TextInputType.number,
            // autofocus: true, // CustomTextField doesn't have autofocus yet, but it's okay
          ),
        ],
      ),
      actions: [
        if (widget.onDelete != null)
          TextButton(
            onPressed: () {
              widget.onDelete!();
              Navigator.of(context).pop();
            },
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Eliminar'),
          ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        ElevatedButton(
          onPressed: () {
            final cantidad = int.tryParse(_cantidadCtrl.text) ?? 1;
            if (cantidad > 0) {
              widget.onConfirm(cantidad);
              Navigator.of(context).pop();
            }
          },
          child: const Text('Confirmar'),
        ),
      ],
    );
  }
}
