# Modo simple / avanzado en Cardio (Elíptica, Caminadora, Escaladora)

**Por qué (2026-08-25):** el usuario sintió que la pantalla de ⚙️ Ajustes dentro de Cardio tenía
"demasiadas funciones" para alguien que recién empieza, y que Caminadora/Escaladora no se
encontraban fácilmente. Las tres máquinas ya tenían su propia fila en el menú principal
(`cardio.html?m=eliptica|caminadora|escaladora`) — lo que realmente sobraba era el selector
"Equipo" duplicado *dentro* de Cardio, más varios controles técnicos/duplicados de Ajustes
global apilados en un solo overlay.

**Solución:** preferencia global `Configuración avanzada` (`Prefs.getAdvancedMode()` /
`setAdvancedMode()`, key `qg_pref_advanced`), **apagada por defecto**, con su toggle en
`ajustes.html`. `cardio.html` marca con la clase `adv-only` lo que solo se muestra cuando está
prendida; el resto (nivel, duración, aviso de sprint, modo gimnasio, peso, beeps, música, racha)
siempre visible.

## Qué queda oculto por defecto (modo simple) y por qué

| Sección/control | Por qué se oculta |
|---|---|
| **Equipo** (grid elíptica/caminadora/escaladora) | Duplica lo que ya hace el menú principal — cambiar de máquina normalmente es "volver al inicio y tocar otra fila", no esto. |
| **Ajuste rápido ± en vivo** + "Aplicar a los bloques siguientes" | Función de usuario avanzado (corregir intensidad a media sesión); también oculta la fila ±INCLINACIÓN/RESISTENCIA de la pantalla principal (`adjust-row`, gateado en `syncToggleUI()` combinando `adjustOn && advanced-mode`, no solo con la clase CSS). |
| **Límites de tu máquina** (calibración) | Configuración técnica de una sola vez, no algo que un principiante necesite tocar el primer día. |
| **Color** (swatches dentro de Cardio) | Ya existe el mismo picker en Ajustes global (mismo `Prefs.setThemeKey`) — es un duplicado literal, no una opción distinta. |
| **Mantener pantalla encendida** (dentro de "Segundo plano y sonido") | También duplicado exacto de un toggle en Ajustes global. |

Lo que **no** se oculta aunque parezca "avanzado" a primera vista, y por qué:
- **Modo gimnasio ⛶** (números gigantes) — un solo tap, útil también para principiantes que
  entrenan lejos del celular.
- **Beeps de cambio de bloque** — toggle simple, no depende de nada más, y es distinto del aviso
  global de sonido (este es específico de "cambia el bloque", no "se acaba el descanso").
- **Aviso 10 s antes del sprint** — mapea al mismo `Prefs.setSoundWarningOn` que Ajustes, pero se
  deja visible aquí porque el texto explica el motivo en contexto (tiempo para subir carga) que el
  toggle genérico de Ajustes no transmite.

## Trampa de CSS a recordar

`.adv-only { display:none; }` sola **no alcanza** contra `.toggle-row { display:flex; }` — misma
especificidad (una clase cada una), y como `.toggle-row` está definida más abajo en la hoja de
estilos, gana por orden y el toggle se queda visible aunque tenga la clase `adv-only`. Hace falta
subir la especificidad con selectores de dos clases (`.toggle-row.adv-only { display:none; }`,
`.set-group.adv-only { display:none; }`) para que gane sin depender del orden de declaración.

Además, `adjust-row` y `propagate-row` reciben su `display` por **JS inline** (`style.display=...`
en `syncToggleUI()`), no solo por CSS — un inline style siempre gana sobre cualquier regla de hoja
de estilos, así que ahí el gateo por modo avanzado tiene que hacerse dentro del propio JS
(`showAdjust = adjustOn && body.classList.contains('advanced-mode')`), no solo con la clase.

## Cómo extender esto a otra página

1. Agregar la clase `adv-only` a los `.set-group`/`.toggle-row` que deban ocultarse por defecto.
2. Copiar las 5 líneas de CSS de este bloque (con los selectores de dos clases, no solo `.adv-only`).
3. Al inicio del script de la página: `document.body.classList.toggle('advanced-mode', window.Prefs && Prefs.getAdvancedMode());` — antes de cualquier función que lea ese estado.
4. Si algo se muestra/oculta también con `style.display` desde JS (no solo CSS), combinar esa condición con `document.body.classList.contains('advanced-mode')` a mano — la clase CSS sola no basta.
