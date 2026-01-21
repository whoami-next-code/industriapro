import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/debug/debug_logger.dart';
import '../../../core/ui/buttons/custom_button.dart';
import '../../../core/ui/inputs/custom_text_field.dart';
import '../../../core/ui/layout/responsive_layout.dart';
import '../providers/auth_providers.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final TextEditingController _userCtrl = TextEditingController();
  final TextEditingController _passCtrl = TextEditingController();
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _userCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final controller = ref.read(authControllerProvider.notifier);
    await controller.login(_userCtrl.text.trim(), _passCtrl.text);

    if (!mounted) return;
    final authState = ref.read(authStateProvider);

    // Solo navegar si el login fue exitoso Y hay token válido
    if (mounted &&
        authState.isAuthenticated &&
        authState.token != null &&
        authState.token!.isNotEmpty) {
      if (authState.mustChangePassword) {
        context.go('/change-password');
      } else {
        context.go('/home');
      }
    }
    // Si hay error, se mostrará automáticamente en la UI (authState.error)
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);

    // #region agent log
    debugLog(
      location: 'login_page.dart:build',
      message: 'login_build_render',
      data: {'isLoading': authState.isLoading, 'uiVersion': 'v2_optimized'},
      hypothesisId: 'H1',
      runId: 'pre-fix-2',
    );
    // #endregion

    return Scaffold(
      body: SafeArea(
        child: ResponsiveLayout(
          mobile: _buildMobile(context, authState),
          tablet: Center(
            child: SizedBox(
              width: 500,
              child: Card(
                elevation: 4,
                margin: const EdgeInsets.all(24),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: _buildForm(context, authState),
                ),
              ),
            ),
          ),
          desktop: Center(
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          Theme.of(context).colorScheme.primary.withValues(alpha: 0.12),
                          Theme.of(context).colorScheme.secondary.withValues(alpha: 0.12),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                    ),
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.construction,
                            size: 120,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                          const SizedBox(height: 24),
                          Text(
                            'Industria SP',
                            style: Theme.of(context)
                                .textTheme
                                .displayMedium
                                ?.copyWith(
                                  fontWeight: FontWeight.bold,
                                  color: Theme.of(context).colorScheme.primary,
                                ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: Center(
                    child: SizedBox(
                      width: 450,
                      child: Padding(
                        padding: const EdgeInsets.all(48),
                        child: _buildForm(context, authState, showHeader: false),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMobile(BuildContext context, dynamic authState) {
    return SingleChildScrollView(
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Theme.of(context).colorScheme.primary.withValues(alpha: 0.12),
                  Theme.of(context).colorScheme.secondary.withValues(alpha: 0.12),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Column(
              children: [
                Icon(
                  Icons.construction,
                  size: 70,
                  color: Theme.of(context).colorScheme.primary,
                ),
                const SizedBox(height: 16),
                Text(
                  'Industria SP',
                  style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Acceso operativo y tecnico',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: const Color(0xFF5B6B7A),
                      ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(24),
            child: Card(
              elevation: 1,
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: _buildForm(context, authState, showHeader: false),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildForm(BuildContext context, dynamic authState,
      {bool showHeader = true}) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (showHeader) ...[
              const SizedBox(height: 40),
              Icon(
                Icons.construction,
                size: 80,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(height: 24),
              Text(
                'Industria SP',
                style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Sistema de Producción',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: Colors.grey[600],
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),
            ],
            if (!showHeader) ...[
               Text(
                'Bienvenido',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 8),
               Text(
                'Inicia sesión para continuar',
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: Colors.grey[600],
                    ),
              ),
              const SizedBox(height: 32),
            ],

            CustomTextField(
              label: 'Usuario / Email',
              controller: _userCtrl,
              prefixIcon: Icons.person_outline,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              validator: (v) =>
                  v == null || v.isEmpty ? 'Ingresa usuario' : null,
            ),
            const SizedBox(height: 16),
            CustomTextField(
              label: 'Contraseña',
              controller: _passCtrl,
              prefixIcon: Icons.lock_outline,
              obscureText: true,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _submit(),
              validator: (v) =>
                  v == null || v.isEmpty ? 'Ingresa contraseña' : null,
            ),
            const SizedBox(height: 32),
            CustomButton(
              text: 'Iniciar Sesión',
              onPressed: _submit,
              isLoading: authState.isLoading,
              isFullWidth: true,
            ),
            if (authState.error != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.errorContainer,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                      color: Theme.of(context).colorScheme.error),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline,
                        color: Theme.of(context).colorScheme.error,
                        size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        authState.error!,
                        style: TextStyle(
                            color: Theme.of(context).colorScheme.error),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
