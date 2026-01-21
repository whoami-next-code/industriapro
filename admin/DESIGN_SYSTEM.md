# Sistema de diseño del panel Admin

## Principios
- **Paleta pastel profesional** con tres colores primarios (azul, menta, lavanda).
- **Jerarquía visual** por niveles de superficie y sombras suaves.
- **Accesibilidad WCAG AA** con contraste suficiente y foco visible.
- **Modularidad**: tarjetas, widgets, tablas y botones reutilizables.

## Paleta de color (tokens CSS)
- `--brand-primary` `#7ba7ff` (azul pastel)
- `--brand-secondary` `#7fd1c8` (menta pastel)
- `--brand-accent` `#c9b8ff` (lavanda pastel)
- Neutrales: `--surface`, `--surface-2`, `--surface-card`, `--text`, `--text-muted`, `--border`

## Tipografía
- **Texto general**: `IBM Plex Sans`.
- **Títulos**: `Roboto Condensed`.

## Componentes base
- **Tarjetas**: `.sp-card`, `.sp-card-header`, `.sp-card-body`
- **Widgets**: `.sp-widget` + `sp-widget-{primary|secondary|accent}`
- **Botones**: `.sp-button` + `sp-button-{primary|outline|ghost}`
- **Badges**: `.sp-badge` + `sp-badge-{primary|secondary|accent}`
- **Tablas**: `.sp-table`
- **Inputs**: `.sp-input`, `.sp-select`, `.sp-textarea`, `.sp-file`, `.sp-form-label`
- **Paneles**: `.sp-panel`

## Layout
- **Sidebar**: `.sp-sidebar` con secciones categorizadas.
- **Topbar**: `.sp-topbar` con acciones rápidas y notificaciones.
- **Contenido**: contenedor `.sp-main` max 1800px para pantallas 1280px–4K.

## Accesibilidad
- Foco visible con `:focus-visible` y color `--focus`.
- Tamaños legibles y contraste AA en texto principal.
- Animaciones desactivadas con `prefers-reduced-motion`.

## Reglas de uso
- Mantener un máximo de **tres colores primarios**.
- Usar sombras suaves (`--shadow-*`) para indicar profundidad.
- Preferir iconos de `@heroicons` en acciones principales.
