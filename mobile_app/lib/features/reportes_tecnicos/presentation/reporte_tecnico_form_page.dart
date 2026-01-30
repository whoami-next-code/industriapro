import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../data/repositories/contactos_tecnicos_repository.dart';
import '../../../core/config/app_config.dart';
import '../../../domain/entities/contacto_tecnico.dart';
import '../providers/contactos_tecnicos_providers.dart';

class ReporteTecnicoFormPage extends ConsumerStatefulWidget {
  const ReporteTecnicoFormPage({super.key, required this.id});

  final String id;

  @override
  ConsumerState<ReporteTecnicoFormPage> createState() =>
      _ReporteTecnicoFormPageState();
}

class _ReporteTecnicoFormPageState
    extends ConsumerState<ReporteTecnicoFormPage> {
  final _formKey = GlobalKey<FormState>();
  final _mensajeCtrl = TextEditingController();
  final _foundCtrl = TextEditingController();
  final _resolvedCtrl = TextEditingController();
  bool _sending = false;
  final ImagePicker _picker = ImagePicker();
  final List<XFile> _evidencias = [];

  @override
  void dispose() {
    _mensajeCtrl.dispose();
    _foundCtrl.dispose();
    _resolvedCtrl.dispose();
    super.dispose();
  }

  Future<void> _seleccionarFoto() async {
    try {
      final XFile? imagen = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 85,
      );
      if (imagen != null) {
        setState(() => _evidencias.add(imagen));
      }
    } catch (_) {}
  }

  Future<void> _seleccionarDeGaleria() async {
    try {
      final XFile? imagen = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 85,
      );
      if (imagen != null) {
        setState(() => _evidencias.add(imagen));
      }
    } catch (_) {}
  }

  void _eliminarEvidencia(int index) {
    setState(() => _evidencias.removeAt(index));
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _sending = true);

    try {
      final repo = ref.read(contactosTecnicosRepositoryProvider);
      List<String> attachmentUrls = [];
      if (_evidencias.isNotEmpty) {
        attachmentUrls = await repo.subirEvidencias(_evidencias);
      }

      await repo.enviarReporte(
        int.tryParse(widget.id) ?? 0,
        {
          'message': _mensajeCtrl.text.trim(),
          'found': _foundCtrl.text.trim().isEmpty ? null : _foundCtrl.text.trim(),
          'resolved': _resolvedCtrl.text.trim().isEmpty ? null : _resolvedCtrl.text.trim(),
          'evidenceUrls': attachmentUrls,
        },
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Reporte enviado correctamente'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error al enviar reporte: $e'),
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
    final asyncContactos = ref.watch(contactosTecnicosProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Nuevo reporte técnico'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            asyncContactos.when(
              data: (items) {
                final contacto = items.firstWhere(
                  (c) => c.id == (int.tryParse(widget.id) ?? -1),
                  orElse: () => ContactoTecnico(
                    id: 0,
                    nombre: '',
                    email: '',
                    telefono: '',
                    mensaje: '',
                    estado: '',
                    creadoEn: DateTime.fromMillisecondsSinceEpoch(0),
                  ),
                );
                final reportes = contacto.id == 0 ? const <ReporteTecnico>[] : contacto.reportes;
                if (reportes.isEmpty) {
                  return const SizedBox.shrink();
                }
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _SectionCard(
                      title: 'Reportes anteriores',
                      subtitle: '${reportes.length} registrado(s)',
                      child: Column(
                        children: reportes.map((r) {
                          return Container(
                            width: double.infinity,
                            margin: const EdgeInsets.only(bottom: 12),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.grey.shade50,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.grey.shade200),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  r.message,
                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  r.createdAt.toLocal().toString(),
                                  style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                                ),
                                if (r.found != null && r.found!.isNotEmpty)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 6),
                                    child: Text('Cómo se encontró: ${r.found}'),
                                  ),
                                if (r.resolved != null && r.resolved!.isNotEmpty)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 6),
                                    child: Text('Cómo quedó: ${r.resolved}'),
                                  ),
                                if (r.evidenceUrls.isNotEmpty) ...[
                                  const SizedBox(height: 8),
                                  SizedBox(
                                    height: 80,
                                    child: ListView.separated(
                                      scrollDirection: Axis.horizontal,
                                      itemCount: r.evidenceUrls.length,
                                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                                      itemBuilder: (context, index) {
                                        final url = AppConfig.buildImageUrl(r.evidenceUrls[index]);
                                        return ClipRRect(
                                          borderRadius: BorderRadius.circular(8),
                                          child: Image.network(
                                            url,
                                            width: 80,
                                            height: 80,
                                            fit: BoxFit.cover,
                                            errorBuilder: (_, __, ___) => Container(
                                              width: 80,
                                              height: 80,
                                              color: Colors.grey.shade200,
                                              child: const Icon(Icons.broken_image, color: Colors.grey),
                                            ),
                                          ),
                                        );
                                      },
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                );
              },
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
            ),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Theme.of(context).colorScheme.outline),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(Icons.info_outline, color: Theme.of(context).colorScheme.primary),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'Completa el reporte con el estado inicial, lo realizado y las evidencias.',
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _SectionCard(
              title: 'Resumen del trabajo',
              subtitle: 'Obligatorio',
              child: TextFormField(
                controller: _mensajeCtrl,
                decoration: const InputDecoration(
                  labelText: 'Resumen',
                  hintText: 'Ej. Se ajustó tablero y se restableció el sistema',
                ),
                minLines: 2,
                maxLines: 4,
                validator: (value) =>
                    value == null || value.trim().isEmpty ? 'Campo requerido' : null,
              ),
            ),
            const SizedBox(height: 12),
            _SectionCard(
              title: 'Cómo se encontró',
              subtitle: 'Opcional',
              child: TextFormField(
                controller: _foundCtrl,
                decoration: const InputDecoration(
                  labelText: 'Estado inicial',
                  hintText: 'Describe el estado inicial del servicio',
                ),
                minLines: 2,
                maxLines: 4,
              ),
            ),
            const SizedBox(height: 12),
            _SectionCard(
              title: 'Cómo quedó',
              subtitle: 'Opcional',
              child: TextFormField(
                controller: _resolvedCtrl,
                decoration: const InputDecoration(
                  labelText: 'Resultado final',
                  hintText: 'Describe el resultado final',
                ),
                minLines: 2,
                maxLines: 4,
              ),
            ),
            const SizedBox(height: 12),
            _SectionCard(
              title: 'Evidencias',
              subtitle: _evidencias.isEmpty
                  ? 'Sin evidencias adjuntas'
                  : '${_evidencias.length} adjunta(s)',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _seleccionarFoto,
                          icon: const Icon(Icons.camera_alt_outlined),
                          label: const Text('Tomar foto'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _seleccionarDeGaleria,
                          icon: const Icon(Icons.photo_library_outlined),
                          label: const Text('Galería'),
                        ),
                      ),
                    ],
                  ),
                  if (_evidencias.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: List.generate(_evidencias.length, (index) {
                        return Chip(
                          label: Text('Evidencia ${index + 1}'),
                          onDeleted: () => _eliminarEvidencia(index),
                        );
                      }),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: _sending ? null : _submit,
              icon: _sending
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send),
              label: Text(_sending ? 'Enviando...' : 'Enviar reporte'),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.subtitle,
    required this.child,
  });

  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Theme.of(context).colorScheme.outline),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: const Color(0xFF7C8CA3),
                ),
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}
