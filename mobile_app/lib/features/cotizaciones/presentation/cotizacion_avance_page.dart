import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../data/repositories/cotizaciones_repository.dart';
import '../providers/cotizaciones_providers.dart';

class CotizacionAvancePage extends ConsumerStatefulWidget {
  const CotizacionAvancePage({super.key, required this.id});

  final String id;

  @override
  ConsumerState<CotizacionAvancePage> createState() => _CotizacionAvancePageState();
}

class _CotizacionAvancePageState extends ConsumerState<CotizacionAvancePage> {
  final _formKey = GlobalKey<FormState>();
  final _mensajeCtrl = TextEditingController();
  final _porcentajeCtrl = TextEditingController(text: '0');
  final _materialCtrl = TextEditingController();
  final _cantidadCtrl = TextEditingController();
  final _unidadCtrl = TextEditingController(text: 'pieza');
  
  bool _sending = false;
  String? _estadoSeleccionado;
  final List<XFile> _evidencias = [];
  final List<Map<String, dynamic>> _materialesList = [];
  final ImagePicker _picker = ImagePicker();

  final List<String> _estadosDisponibles = [
    'PENDIENTE',
    'EN_PROCESO',
    'PRODUCCION',
    'INSTALACION',
    'FINALIZADA',
  ];

  int _porcentajePorEstado(String? estado) {
    switch (estado?.toUpperCase()) {
      case 'PENDIENTE':
        return 0;
      case 'EN_PROCESO':
        return 25;
      case 'PRODUCCION':
        return 60;
      case 'INSTALACION':
        return 85;
      case 'FINALIZADA':
        return 100;
      default:
        return int.tryParse(_porcentajeCtrl.text) ?? 0;
    }
  }

  @override
  void dispose() {
    _mensajeCtrl.dispose();
    _porcentajeCtrl.dispose();
    _materialCtrl.dispose();
    _cantidadCtrl.dispose();
    _unidadCtrl.dispose();
    super.dispose();
  }

  Future<void> _seleccionarFoto() async {
    try {
      final XFile? imagen = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 85,
      );
      if (imagen != null) {
        setState(() {
          _evidencias.add(imagen);
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error al seleccionar foto: $e')),
        );
      }
    }
  }

  Future<void> _seleccionarDeGaleria() async {
    try {
      final XFile? imagen = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 85,
      );
      if (imagen != null) {
        setState(() {
          _evidencias.add(imagen);
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error al seleccionar imagen: $e')),
        );
      }
    }
  }

  void _eliminarEvidencia(int index) {
    setState(() {
      _evidencias.removeAt(index);
    });
  }

  void _agregarMaterial() {
    if (_materialCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ingresa el nombre del material')),
      );
      return;
    }
    if (_cantidadCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Ingresa la cantidad')),
      );
      return;
    }

    setState(() {
      _materialesList.add({
        'nombre': _materialCtrl.text.trim(),
        'cantidad': _cantidadCtrl.text.trim(),
        'unidad': _unidadCtrl.text,
      });
      _materialCtrl.clear();
      _cantidadCtrl.clear();
    });
  }

  void _eliminarMaterial(int index) {
    setState(() {
      _materialesList.removeAt(index);
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    
    setState(() => _sending = true);
    final repo = ref.read(cotizacionesRepositoryProvider);

    try {
      // Si hay datos en los campos de material que no se han agregado a la lista, agregarlos
      if (_materialCtrl.text.isNotEmpty && _cantidadCtrl.text.isNotEmpty) {
        _materialesList.add({
          'nombre': _materialCtrl.text.trim(),
          'cantidad': _cantidadCtrl.text.trim(),
          'unidad': _unidadCtrl.text,
        });
      }

      // Subir adjuntos primero
      List<String> attachmentUrls = [];
      if (_evidencias.isNotEmpty) {
         attachmentUrls = await repo.subirAdjuntos(_evidencias);
      }

      // Formatear materiales a string
      String? materialsString;
      if (_materialesList.isNotEmpty) {
        materialsString = _materialesList.map((m) => '- ${m['nombre']}: ${m['cantidad']} ${m['unidad']}').join('\n');
      }

      // Preparar datos del avance
      final avanceData = {
        'message': _mensajeCtrl.text.trim().isEmpty 
            ? 'Avance reportado' 
            : _mensajeCtrl.text.trim(),
        'status': _estadoSeleccionado,
        'progressPercent': int.tryParse(_porcentajeCtrl.text) ?? 0,
        'materials': materialsString,
        'attachmentUrls': attachmentUrls,
      };

      // Enviar avance
      await repo.agregarAvance(widget.id, avanceData);

      if (mounted) {
        // Refrescar el detalle
        ref.invalidate(cotizacionDetalleProvider(widget.id));
        // Refrescar la lista general
        ref.invalidate(cotizacionesProvider);
        
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Avance enviado exitosamente'),
            backgroundColor: Colors.green,
          ),
        );
        
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error al enviar avance: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Reportar Avance'),
        elevation: 0,
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _buildSectionCard(
              title: 'Información del avance',
              icon: Icons.assignment_outlined,
              child: Column(
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: _estadoSeleccionado,
                    decoration: const InputDecoration(
                      labelText: 'Estado',
                      prefixIcon: Icon(Icons.work_outline),
                      border: OutlineInputBorder(),
                    ),
                    items: _estadosDisponibles.map((estado) {
                      return DropdownMenuItem(
                        value: estado,
                        child: Text(estado.replaceAll('_', ' ')),
                      );
                    }).toList(),
                    onChanged: (value) {
                      setState(() {
                        _estadoSeleccionado = value;
                        _porcentajeCtrl.text =
                            _porcentajePorEstado(value).toString();
                      });
                    },
                    validator: (value) => value == null || value.isEmpty
                        ? 'Selecciona un estado'
                        : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _porcentajeCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Porcentaje de avance (%)',
                      prefixIcon: Icon(Icons.percent),
                      border: OutlineInputBorder(),
                      suffixText: '%',
                    ),
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(3),
                    ],
                    validator: (value) {
                      if (value == null || value.isEmpty) return 'Requerido';
                      final n = int.tryParse(value);
                      if (n == null || n < 0 || n > 100) return '0-100';
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _mensajeCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Mensaje / Observaciones',
                      prefixIcon: Icon(Icons.message),
                      border: OutlineInputBorder(),
                      alignLabelWithHint: true,
                    ),
                    maxLines: 3,
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) {
                        return 'El mensaje es requerido';
                      }
                      return null;
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _buildSectionCard(
              title: 'Materiales utilizados',
              icon: Icons.inventory_2_outlined,
              child: Column(
                children: [
                  if (_materialesList.isNotEmpty)
                    Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey.shade300),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _materialesList.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (context, index) {
                          final item = _materialesList[index];
                          return ListTile(
                            dense: true,
                            title: Text(item['nombre']),
                            subtitle:
                                Text('${item['cantidad']} ${item['unidad']}'),
                            trailing: IconButton(
                              icon: const Icon(
                                Icons.delete,
                                color: Colors.red,
                                size: 20,
                              ),
                              onPressed: () => _eliminarMaterial(index),
                            ),
                          );
                        },
                      ),
                    ),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        flex: 3,
                        child: TextFormField(
                          controller: _materialCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Material',
                            isDense: true,
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 2,
                        child: TextFormField(
                          controller: _cantidadCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Cant.',
                            isDense: true,
                            border: OutlineInputBorder(),
                          ),
                          keyboardType: TextInputType.number,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 2,
                        child: TextFormField(
                          controller: _unidadCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Unidad',
                            isDense: true,
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed: _agregarMaterial,
                        icon: const Icon(Icons.add_circle, color: Colors.blue),
                        tooltip: 'Agregar material',
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _buildSectionCard(
              title: 'Evidencias (Fotos)',
              icon: Icons.photo_library_outlined,
              child: Column(
                children: [
                  if (_evidencias.isNotEmpty)
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 3,
                        crossAxisSpacing: 8,
                        mainAxisSpacing: 8,
                      ),
                      itemCount: _evidencias.length,
                      itemBuilder: (context, index) {
                        return Stack(
                          children: [
                            Positioned.fill(
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: kIsWeb
                                    ? Image.network(
                                        _evidencias[index].path,
                                        fit: BoxFit.cover,
                                      )
                                    : Image.file(
                                        File(_evidencias[index].path),
                                        fit: BoxFit.cover,
                                      ),
                              ),
                            ),
                            Positioned(
                              top: 4,
                              right: 4,
                              child: InkWell(
                                onTap: () => _eliminarEvidencia(index),
                                child: Container(
                                  padding: const EdgeInsets.all(4),
                                  decoration: const BoxDecoration(
                                    color: Colors.black54,
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                    Icons.close,
                                    size: 16,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      ElevatedButton.icon(
                        onPressed: _seleccionarFoto,
                        icon: const Icon(Icons.camera_alt),
                        label: const Text('Cámara'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.grey.shade200,
                          foregroundColor: Colors.black87,
                        ),
                      ),
                      ElevatedButton.icon(
                        onPressed: _seleccionarDeGaleria,
                        icon: const Icon(Icons.photo_library),
                        label: const Text('Galería'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.grey.shade200,
                          foregroundColor: Colors.black87,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              height: 50,
              child: FilledButton(
                onPressed: _sending ? null : _submit,
                child: _sending
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text('GUARDAR AVANCE'),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionCard({
    required String title,
    required Widget child,
    IconData? icon,
  }) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon ?? Icons.info_outline, size: 18, color: Colors.grey),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}
