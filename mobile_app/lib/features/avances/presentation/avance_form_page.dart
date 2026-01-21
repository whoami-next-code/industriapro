import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';

import '../../../data/repositories/pedidos_repository.dart';
import '../../../domain/entities/evidencia.dart';
import '../../pedidos_detalle/providers/pedidos_providers.dart';

class AvanceFormPage extends ConsumerStatefulWidget {
  const AvanceFormPage({super.key, required this.pedidoId});

  final String pedidoId;

  @override
  ConsumerState<AvanceFormPage> createState() => _AvanceFormPageState();
}

class _AvanceFormPageState extends ConsumerState<AvanceFormPage> {
  final _formKey = GlobalKey<FormState>();
  final _mensajeCtrl = TextEditingController();
  final _estadoCtrl = TextEditingController();
  final _porcentajeCtrl = TextEditingController(text: '0');
  final _materialCtrl = TextEditingController();
  final _cantidadCtrl = TextEditingController();
  final _unidadCtrl = TextEditingController(text: 'pieza');
  
  bool _sending = false;
  String? _estadoSeleccionado;
  final List<File> _evidencias = [];
  final List<Map<String, dynamic>> _materialesList = [];
  final ImagePicker _picker = ImagePicker();

  final List<String> _estadosDisponibles = [
    'PENDIENTE',
    'EN_PROCESO',
    'CORTE',
    'SOLDADURA',
    'ARMADO',
    'PINTURA',
    'INSTALACION',
    'COMPLETADO',
  ];

  final List<String> _unidadesDisponibles = [
    'pieza',
    'metro',
    'kg',
    'litro',
    'm²',
    'm³',
  ];

  @override
  void dispose() {
    _mensajeCtrl.dispose();
    _estadoCtrl.dispose();
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
          _evidencias.add(File(imagen.path));
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
          _evidencias.add(File(imagen.path));
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
        'cantidad': double.tryParse(_cantidadCtrl.text) ?? 0,
        'unidad': _unidadCtrl.text,
      });
      _materialCtrl.clear();
      _cantidadCtrl.clear();
      // Keep unit as is or reset? Keep as is for convenience.
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
    final repo = ref.read(pedidosRepositoryProvider);

    try {
      // Si hay datos en los campos de material que no se han agregado a la lista, agregarlos
      if (_materialCtrl.text.isNotEmpty && _cantidadCtrl.text.isNotEmpty) {
        _materialesList.add({
          'nombre': _materialCtrl.text.trim(),
          'cantidad': double.tryParse(_cantidadCtrl.text) ?? 0,
          'unidad': _unidadCtrl.text,
        });
      }

      // Preparar datos del avance según formato del backend
      final avanceData = {
        'mensaje': _mensajeCtrl.text.trim().isEmpty 
            ? 'Avance reportado' 
            : _mensajeCtrl.text.trim(),
        'message': _mensajeCtrl.text.trim().isEmpty 
            ? 'Avance reportado' 
            : _mensajeCtrl.text.trim(),
        'estado': _estadoSeleccionado ?? _estadoCtrl.text.trim(),
        'status': _estadoSeleccionado ?? _estadoCtrl.text.trim(),
        'porcentaje': int.tryParse(_porcentajeCtrl.text) ?? 0,
        'materiales': _materialesList,
      };

      // Enviar avance
      await repo.enviarAvance(widget.pedidoId, avanceData);

      // Si hay evidencias, enviarlas por separado
      if (_evidencias.isNotEmpty) {
        try {
          final evidencias = _evidencias.map((file) {
            return Evidencia(
              tipo: TipoEvidencia.armado, // Tipo por defecto
              pathLocal: file.path,
              comentario: 'Evidencia del avance',
            );
          }).toList();

          await repo.enviarEvidencias(widget.pedidoId, evidencias);
        } catch (e) {
          // Si falla el envío de evidencias, mostrar advertencia pero no fallar el avance
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Avance enviado, pero hubo un problema al subir las fotos: ${e.toString().replaceAll('Exception: ', '')}'),
                backgroundColor: Colors.orange,
                duration: const Duration(seconds: 4),
              ),
            );
          }
        }
      }

      if (mounted) {
        // Refrescar el detalle del pedido para mostrar el nuevo avance
        ref.invalidate(pedidoDetalleProvider(widget.pedidoId));
        
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Avance enviado exitosamente'),
            backgroundColor: Colors.green,
            duration: Duration(seconds: 2),
          ),
        );
        
        // Esperar un momento para que el usuario vea el mensaje de éxito
        await Future.delayed(const Duration(milliseconds: 500));
        
        if (mounted) {
          context.pop();
        }
      }
    } catch (e) {
      if (mounted) {
        String errorMessage = 'Error al enviar avance';
        
        // Mensajes de error más específicos
        final errorString = e.toString().toLowerCase();
        if (errorString.contains('network') || errorString.contains('connection')) {
          errorMessage = 'Error de conexión. Verifica tu internet e intenta nuevamente';
        } else if (errorString.contains('401') || errorString.contains('unauthorized')) {
          errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente';
        } else if (errorString.contains('timeout')) {
          errorMessage = 'Tiempo de espera agotado. Intenta nuevamente';
        } else if (errorString.contains('500') || errorString.contains('server')) {
          errorMessage = 'Error del servidor. Intenta más tarde';
        } else {
          errorMessage = 'Error al enviar avance: ${e.toString().replaceAll('Exception: ', '').split('\n').first}';
        }
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 4),
            action: SnackBarAction(
              label: 'Cerrar',
              textColor: Colors.white,
              onPressed: () {},
            ),
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
        title: Text('Reportar Avance - ${widget.pedidoId}'),
        elevation: 0,
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Estado del avance
            DropdownButtonFormField<String>(
              initialValue: _estadoSeleccionado,
              decoration: const InputDecoration(
                labelText: 'Estado / Etapa',
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
                  if (value != null) {
                    _estadoCtrl.text = value;
                  }
                });
              },
              validator: (v) => v == null && _estadoCtrl.text.isEmpty
                  ? 'Selecciona un estado'
                  : null,
            ),
            const SizedBox(height: 16),

            // Porcentaje de avance
            TextFormField(
              controller: _porcentajeCtrl,
              decoration: const InputDecoration(
                labelText: 'Porcentaje de avance (%)',
                prefixIcon: Icon(Icons.percent),
                border: OutlineInputBorder(),
                helperText: 'Ingresa un valor entre 0 y 100',
              ),
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
              ],
              validator: (v) {
                if (v == null || v.trim().isEmpty) {
                  return 'El porcentaje es requerido';
                }
                final value = int.tryParse(v);
                if (value == null) {
                  return 'Ingresa un número válido';
                }
                if (value < 0 || value > 100) {
                  return 'El porcentaje debe estar entre 0 y 100';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),

            // Mensaje/Observaciones
            TextFormField(
              controller: _mensajeCtrl,
              decoration: const InputDecoration(
                labelText: 'Mensaje / Observaciones',
                prefixIcon: Icon(Icons.note_outlined),
                border: OutlineInputBorder(),
                helperText: 'Describe el avance realizado',
              ),
              maxLines: 4,
              textCapitalization: TextCapitalization.sentences,
            ),
            const SizedBox(height: 24),

            // Sección de materiales (opcional)
            Card(
              elevation: 1,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.inventory_2_outlined, size: 20),
                            const SizedBox(width: 8),
                            Text(
                              'Materiales utilizados',
                              style: Theme.of(context).textTheme.titleSmall,
                            ),
                          ],
                        ),
                        if (_materialesList.isNotEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.blue.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              '${_materialesList.length}',
                              style: TextStyle(color: Colors.blue[800], fontWeight: FontWeight.bold),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          flex: 2,
                          child: TextFormField(
                            controller: _materialCtrl,
                            decoration: const InputDecoration(
                              labelText: 'Material',
                              border: OutlineInputBorder(),
                              isDense: true,
                              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextFormField(
                            controller: _cantidadCtrl,
                            decoration: const InputDecoration(
                              labelText: 'Cant.',
                              border: OutlineInputBorder(),
                              isDense: true,
                              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            ),
                            keyboardType: TextInputType.number,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            initialValue: _unidadCtrl.text,
                            decoration: const InputDecoration(
                              labelText: 'Unidad',
                              border: OutlineInputBorder(),
                              isDense: true,
                              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            ),
                            items: _unidadesDisponibles.map((unidad) {
                              return DropdownMenuItem(
                                value: unidad,
                                child: Text(unidad, style: const TextStyle(fontSize: 12)),
                              );
                            }).toList(),
                            onChanged: (value) {
                              if (value != null) {
                                _unidadCtrl.text = value;
                              }
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton(
                          onPressed: _agregarMaterial,
                          icon: const Icon(Icons.add_circle, color: Colors.blue),
                          tooltip: 'Agregar material',
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                        ),
                      ],
                    ),
                    if (_materialesList.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      const Divider(),
                      const SizedBox(height: 8),
                      ListView.builder(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: _materialesList.length,
                        itemBuilder: (context, index) {
                          final item = _materialesList[index];
                          return ListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.check_circle_outline, size: 16, color: Colors.green),
                            title: Text('${item['nombre']}'),
                            subtitle: Text('${item['cantidad']} ${item['unidad']}'),
                            trailing: IconButton(
                              icon: const Icon(Icons.delete_outline, size: 20, color: Colors.red),
                              onPressed: () => _eliminarMaterial(index),
                            ),
                          );
                        },
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Sección de evidencias
            Card(
              elevation: 1,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.photo_camera_outlined, size: 20),
                        const SizedBox(width: 8),
                        Text(
                          'Evidencias fotográficas',
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        ElevatedButton.icon(
                          onPressed: _sending ? null : _seleccionarFoto,
                          icon: const Icon(Icons.camera_alt, size: 18),
                          label: const Text('Cámara'),
                          style: ElevatedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 12,
                            ),
                          ),
                        ),
                        OutlinedButton.icon(
                          onPressed: _sending ? null : _seleccionarDeGaleria,
                          icon: const Icon(Icons.photo_library, size: 18),
                          label: const Text('Galería'),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (_evidencias.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Text(
                        'Fotos seleccionadas (${_evidencias.length})',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: 8),
                      SizedBox(
                        height: 100,
                        child: ListView.builder(
                          scrollDirection: Axis.horizontal,
                          itemCount: _evidencias.length,
                          itemBuilder: (context, index) {
                            return Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: Stack(
                                children: [
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(8),
                                    child: Image.file(
                                      _evidencias[index],
                                      width: 100,
                                      height: 100,
                                      fit: BoxFit.cover,
                                    ),
                                  ),
                                  Positioned(
                                    top: 4,
                                    right: 4,
                                    child: CircleAvatar(
                                      radius: 12,
                                      backgroundColor: Colors.red,
                                      child: IconButton(
                                        padding: EdgeInsets.zero,
                                        iconSize: 16,
                                        icon: const Icon(Icons.close, color: Colors.white),
                                        onPressed: () => _eliminarEvidencia(index),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Botón de envío
            SizedBox(
              height: 50,
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _sending ? null : _submit,
                icon: _sending
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : const Icon(Icons.send),
                label: Text(_sending ? 'Enviando...' : 'Enviar Avance'),
                style: ElevatedButton.styleFrom(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 2,
                ),
              ),
            ),
            const SizedBox(height: 16),
            
            // Información adicional
            if (!_sending)
              Text(
                'Nota: El avance se guardará y aparecerá en el historial del pedido',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.grey[600],
                      fontStyle: FontStyle.italic,
                    ),
                textAlign: TextAlign.center,
              ),
          ],
        ),
      ),
    );
  }
}

