# Personalización de color + descubrimiento del modo arcoíris — diseño

**Fecha:** 2026-08-24
**Estado:** aprobado, pendiente de plan de implementación

## Contexto y motivo

`cardio.html` ya tiene un selector completo de 12 temas de color (no solo un acento — cambia fondo, superficies, texto y acento juntos), pero vive aislado ahí: nadie más en la app puede cambiar el color de la interfaz. Al mismo tiempo, `ajustes.html` (feature recién mergeada) muestra un texto "🔒 Hay un modo de color secreto por descubrir en Inicio" que revela la existencia del easter egg del modo arcoíris sin dejar que se descubra de forma orgánica, y el mecanismo de descubrimiento (tocar 6 zonas invisibles en `index.html`) es completamente ajeno a la nueva sección de Color.

El usuario pide: (1) que la gente pueda personalizar el color de toda la app desde Ajustes, reusando la paleta que ya existe en Cardio; (2) quitar el texto que revela el secreto; (3) que el modo arcoíris se descubra tocando los colores en el orden correcto (rojo→naranja→amarillo→verde→azul→morado) dentro de esa misma sección de Color, reemplazando por completo el truco de las 6 zonas invisibles.

## Alcance

**Ahora:**
- `prefs.js` gana los 12 temas completos de `cardio.html` (`negro, blanco, morado, azul, verde, rojo, naranja, rosa, cian, amarillo, grafito, menta`), más 3 funciones: `getThemeKey()` (default `'negro'` — el tema que ya usan hoy las 8 páginas, así nadie ve un cambio si nunca abre Ajustes), `setThemeKey(k)`, `applyThemeIfSet()` (aplica el tema actual sobre las 8 variables CSS compartidas — `--bg`, `--surface`, `--surface2`, `--text`, `--muted`, `--border`, `--accent`, `--accent-text` — más el `<meta name="theme-color">`, exactamente el mismo mecanismo que ya usa `applyTheme()` en `cardio.html` hoy). También expone una función para listar los temas disponibles con su color de muestra, para que las páginas puedan dibujar los círculos sin duplicar la paleta.
- Las 8 páginas HTML llaman `Prefs.applyThemeIfSet()` al cargar (mismo punto donde ya llaman `Prefs.applyRainbowIfOn()` — el tema se aplica primero, el efecto arcoíris después, para que el ciclo de acento del arcoíris quede por encima si está activo).
- **`ajustes.html`** — nueva sección "Color": una rueda de 12 círculos (mismo diseño visual que ya existe en Cardio — `.swatches`/`.swatch`), tocar uno aplica ese tema al instante en toda la app vía `Prefs.setThemeKey()`. Se elimina el texto "🔒 Hay un modo de color secreto...".
- **Descubrimiento del modo arcoíris, dentro de esta misma sección:** tocar los círculos en la secuencia 🔴 rojo → 🟠 naranja → 🟡 amarillo → 🟢 verde → 🔵 azul → 🟣 morado (en ese orden, sin tocar otro color en medio, con máximo 4 segundos entre cada toque — igual que el mecanismo que se reemplaza) activa/desactiva el modo arcoíris permanente (`Prefs.setRainbowOn(!Prefs.isRainbowOn())`). Un toque fuera de secuencia, o que se pase de los 4 segundos, reinicia el conteo — salvo que ese toque sea "rojo" (el primer color), en cuyo caso reinicia y cuenta como el primer paso de un nuevo intento (mismo comportamiento exacto que ya tenía el truco de las 6 zonas en `index.html`, solo que aplicado a los círculos de color en vez de zonas invisibles). Cada círculo sigue aplicando su tema normalmente al tocarlo — el secreto es una capa adicional sobre la misma acción visible, no una acción separada.
- **`index.html`** — se elimina por completo el mecanismo de las 6 zonas invisibles (markup `.rainbow-zone`, su CSS, y el listener de descubrimiento) — ya no es necesario, el nuevo punto de entrada es exclusivamente `ajustes.html`.
- **`cardio.html`** — su selector de 12 temas (ya construido, mismo `THEMES`/`applyTheme()`) se migra a leer/escribir `Prefs.getThemeKey()`/`Prefs.setThemeKey()` en vez de su propio `qg_config.themeKey` — mismo patrón que ya se usó hoy para migrar `bgMode`/`preWarn`, incluyendo migración de una sola vez del valor guardado si el usuario ya tenía un tema elegido antes de este cambio. Los swatches de Cardio **no** participan en la detección de la secuencia secreta — esa lógica vive únicamente en `ajustes.html`.

**Después (fuera de alcance, pospuesto explícitamente):**
- Temas personalizados/editor de color (los 12 temas son fijos, tomados tal cual de Cardio).
- Sincronizar el tema elegido entre dispositivos vía Supabase — es una preferencia de interfaz por navegador, igual que sonido/pantalla/arcoíris.
- Cambiar los 12 colores existentes o agregar nuevos a la paleta.

## Modelo de datos (`localStorage`, nueva llave)

```
qg_pref_theme   una de: negro | blanco | morado | azul | verde | rojo | naranja | rosa | cian | amarillo | grafito | menta
                (default si no existe: "negro")
```

## Interfaz nueva de `prefs.js`

```js
window.Prefs = {
  // ...lo ya existente (sonido, pantalla, fullscreen, arcoíris)...
  getThemeKey() -> string,              // default 'negro'
  setThemeKey(k) -> void,               // valida contra la lista de temas conocidos; ignora una llave inválida
  applyThemeIfSet() -> void,            // aplica el tema actual sobre las 8 variables CSS + theme-color meta (llamar al cargar cualquier página)
  getThemeList() -> {key, swatch}[]     // para dibujar los círculos sin duplicar la paleta de colores en cada página
};
```

## Puntos de enganche

| Página | Aplica tema al cargar | Selector de color | Detección del secreto |
|---|---|---|---|
| Las 8 páginas HTML | `Prefs.applyThemeIfSet()`, llamado **antes** de `Prefs.applyRainbowIfOn()` en el mismo bloque de arranque — así, si el arcoíris está activo, su ciclo de `--accent` queda por encima del tema base | — | — |
| `ajustes.html` | (incluido arriba) | 12 círculos nuevos, sección "Color" | sí — única página con la secuencia |
| `cardio.html` | (incluido arriba) | sus 12 círculos existentes migran a `Prefs.getThemeKey()`/`setThemeKey()`, con migración de una sola vez del valor guardado | no |
| `index.html` | (incluido arriba) | — | se elimina (zonas invisibles + su lógica) |

## UI de `ajustes.html` — sección Color

```
COLOR
⬤⬤⬤⬤⬤⬤⬤⬤⬤⬤⬤⬤   (12 círculos, mismo estilo que Cardio — el actual con ✓)
[si ya se descubrió el arcoíris antes: toggle "🌈 Modo arcoíris" debajo, igual que hoy]
```

Sin ningún texto que mencione un secreto, descubierto o no — el usuario solo ve los 12 colores.

## CSP

Ningún dominio nuevo — los 12 temas son datos estáticos en `prefs.js`, sin red.

## Testing

- `node --check` sobre `prefs.js` y las 8 páginas modificadas (extracción de `<script>` inline donde aplique).
- Assert-based check de la lógica pura de detección de secuencia: secuencia completa correcta activa, un toque fuera de orden reinicia, tocar "rojo" tras un error reinicia-y-cuenta-como-paso-1 (mismo comportamiento que el mecanismo de zonas que se está reemplazando).
- Regresión manual: cambiar de tema en Ajustes y confirmar que se ve en al menos 2 páginas más (ej. Correr, Gimnasio). Repetir la secuencia rojo→naranja→amarillo→verde→azul→morado en Ajustes y confirmar que el modo arcoíris se activa y el acento cicla en varias páginas. Confirmar que las zonas invisibles ya no existen en `index.html`. Confirmar que el selector de Cardio y el de Ajustes muestran/cambian el mismo tema.
