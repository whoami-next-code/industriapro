import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart' show GoRoute, GoRouter, RouteBase, StatefulShellRoute, StatefulShellBranch;

import '../../core/ui/layout/scaffold_with_nav_bar.dart';
import '../../features/auth/presentation/login_page.dart';
import '../../features/auth/presentation/change_password_page.dart';
import '../../features/auth/providers/auth_providers.dart';
import '../../features/avances/presentation/avance_form_page.dart';
import '../../features/cotizaciones/presentation/cotizacion_detalle_page.dart';
import '../../features/cotizaciones/presentation/cotizacion_avance_page.dart';
import '../../features/pedidos_detalle/presentation/pedido_detalle_page.dart';
import '../../features/home/presentation/home_page.dart';
import '../../features/request/presentation/request_page.dart';
import '../../features/profile/presentation/profile_page.dart';
import '../../features/trabajos/presentation/trabajos_page.dart';
import '../../features/reportes_tecnicos/presentation/reportes_tecnicos_page.dart';
import '../../features/reportes_tecnicos/presentation/reporte_tecnico_form_page.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/login',
    refreshListenable: ref.watch(routerNotifierProvider),
    routes: <RouteBase>[
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: '/change-password',
        name: 'change-password',
        builder: (context, state) => const ChangePasswordPage(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return ScaffoldWithNavBar(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/home',
                name: 'home',
                builder: (context, state) => const HomePage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/workflow',
                name: 'workflow',
                builder: (context, state) => const TrabajosPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/reportes-tecnicos',
                name: 'reportes-tecnicos',
                builder: (context, state) => const ReportesTecnicosPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/request',
                name: 'request',
                builder: (context, state) => const RequestPage(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profile',
                name: 'profile',
                builder: (context, state) => const ProfilePage(),
              ),
            ],
          ),
        ],
      ),
      // Keep existing routes for now, accessible from dashboard or direct link
      GoRoute(
        path: '/pedidos/:id',
        name: 'pedido-detalle',
        builder: (context, state) {
          final String id = state.pathParameters['id']!;
          return PedidoDetallePage(id: id);
        },
      ),
      GoRoute(
        path: '/pedidos/:id/avance',
        name: 'avance-form',
        builder: (context, state) {
          final String id = state.pathParameters['id']!;
          return AvanceFormPage(pedidoId: id);
        },
      ),
      GoRoute(
        path: '/cotizaciones/:id',
        name: 'cotizacion-detalle',
        builder: (context, state) {
          final String id = state.pathParameters['id']!;
          return CotizacionDetallePage(id: id);
        },
      ),
      GoRoute(
        path: '/cotizaciones/:id/avance',
        name: 'cotizacion-avance',
        builder: (context, state) {
          final String id = state.pathParameters['id']!;
          return CotizacionAvancePage(id: id);
        },
      ),
      GoRoute(
        path: '/reportes-tecnicos/:id',
        name: 'reporte-tecnico-form',
        builder: (context, state) {
          final String id = state.pathParameters['id']!;
          return ReporteTecnicoFormPage(id: id);
        },
      ),
    ],
    redirect: (context, state) {
      final bool loggedIn = authState.isAuthenticated;
      final bool hasToken = authState.token != null && authState.token!.isNotEmpty;
      final bool isDemo = authState.user?.id == 'demo';
      final bool isLoggingIn = state.matchedLocation == '/login';
      final bool isChangingPassword = state.matchedLocation == '/change-password';
      final bool isProtectedRoute = !isLoggingIn;

      // Si es modo demo, permitir acceso pero no hacer requests protegidas
      if (isDemo && isProtectedRoute) {
        return null; // Permitir acceso en modo demo
      }

      // Para rutas protegidas, verificar que haya token real (no demo)
      if (isProtectedRoute && (!loggedIn || !hasToken)) {
        return '/login';
      }

      if (loggedIn && hasToken && authState.mustChangePassword) {
        if (!isChangingPassword) {
          return '/change-password';
        }
        return null;
      }

      if (isChangingPassword && (!loggedIn || !hasToken)) {
        return '/login';
      }

      // Si está logueado con token real y está en login, redirigir a home
      if (loggedIn && hasToken && !isDemo && isLoggingIn) {
        return '/home';
      }

      return null;
    },
  );
});

final routerNotifierProvider = Provider<ChangeNotifier>((ref) {
  final notifier = _RouterNotifier(ref);
  ref.onDispose(notifier.dispose);
  return notifier;
});

class _RouterNotifier extends ChangeNotifier {
  _RouterNotifier(this.ref) {
    _sub = ref.listen<AuthState>(
      authStateProvider,
      (_, __) => notifyListeners(),
    );
  }

  final Ref ref;
  late final ProviderSubscription<AuthState> _sub;

  @override
  void dispose() {
    _sub.close();
    super.dispose();
  }
}
