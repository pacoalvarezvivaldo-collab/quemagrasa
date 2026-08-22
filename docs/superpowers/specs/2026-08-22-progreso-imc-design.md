# Progreso de peso + IMC — diseño

**Fecha:** 2026-08-22
**Estado:** aprobado, pendiente de plan de implementación

## Contexto y motivo

Hoy `correr.html` tiene un solo campo de peso (`correr_weight` en `localStorage`), usado únicamente para calcular kcal quemadas — se sobreescribe cada vez, sin historial. No existe bitácora de peso a lo largo del tiempo, ni forma de ver cuánto ha bajado la persona, ni cálculo de índice de masa corporal (IMC). El usuario quiere ambas cosas directo en la pantalla de inicio: una bitácora diaria de peso con gráfica (real vs. una línea teórica hacia una meta) y un indicador de IMC con semáforo de color.

## Alcance

**Ahora:**
- Tarjeta nueva "📊 Tu progreso" en `index.html`, arriba de la lista de modos, expandible/colapsable.
- Registro diario de peso (un valor por día, se actualiza si ya existe el de hoy).
- Estatura, pedida una sola vez junto al primer registro de peso, editable después.
- Meta opcional (peso objetivo + fecha límite), editable/quitable en cualquier momento.
- Gráfica SVG: línea real (peso registrado) + línea teórica punteada (recta desde el primer registro hasta la meta), si hay meta puesta.
- Resumen en texto: cuánto ha bajado desde el primer registro, y si hay meta, si va a tiempo/atrasado/adelantado respecto a la teórica.
- Badge de IMC (último peso / estatura²) con las 4 bandas OMS y color: 🔵 bajo peso, 🟢 normal, 🟠 sobrepeso, 🔴 obesidad. Solo se muestra si hay estatura guardada.
- `correr.html` deja de tener su propio peso aislado: su input de "peso (para kcal)" pasa a leer/escribir la misma bitácora (`qg_weight_log`), tomando siempre el último registro. Al editarlo ahí también se guarda/actualiza el registro del día — una sola fuente de verdad para el peso en toda la app.

**Después (fuera de alcance, pospuesto explícitamente):**
- Sincronización con Supabase (`sync.js`) — la bitácora, estatura y meta quedan 100% locales por ahora, igual que el progreso de Gimnasio. Se puede agregar después con una tabla nueva tipo `weight_log` + campos en `user_state`, siguiendo el mismo patrón que `run_history`/`pushRun`.
- Proyección basada en déficit calórico o cualquier fórmula "científica" — la teórica es una recta simple entre dos puntos, no un modelo metabólico.
- Editar/borrar registros individuales de la bitácora (solo se puede sobreescribir el de hoy) — un histórico editable a mano es una extensión futura si hace falta.
- Más easter eggs — el usuario mencionó que se irán agregando después, no entran en esta spec.

## Modelo de datos (`localStorage`, prefijo `qg_` como el resto de easter eggs de `index.html`)

- `qg_weight_log`: JSON array de `{ date: "YYYY-MM-DD", weightKg: number }`, ordenado por fecha ascendente. Un registro por día — si ya existe uno con la fecha de hoy, se sobreescribe su `weightKg` en vez de agregar otro.
- `qg_height_cm`: número. Se pide junto con el primer registro de peso; después editable desde el panel.
- `qg_goal_weight_kg` / `qg_goal_date` ("YYYY-MM-DD"): opcionales, ambos o ninguno — no tiene sentido una meta con solo uno de los dos. Editables/quitables en cualquier momento desde el panel.

`correr.html` deja de usar `correr_weight` como fuente propia: lee el último `weightKg` de `qg_weight_log` para el cálculo de kcal, y si el usuario edita el campo ahí, escribe/actualiza el registro de hoy en `qg_weight_log` (mismo helper compartido que usa `index.html`). Se retiran `KEY_WEIGHT`/`loadWeight`/`saveWeight` de `correr.html` en favor de este helper.

## UI / flujo en `index.html`

Tarjeta "📊 Tu progreso" en `.mode-list`, mismo estilo visual que `.mode-row` pero con `onclick` que expande/colapsa un panel en vez de navegar.

**Primera vez** (sin `qg_weight_log`): el panel expandido muestra un mini-formulario con 2 inputs (peso, estatura) y un botón "Guardar". Al guardar, crea el primer registro de `qg_weight_log` y guarda `qg_height_cm`.

**Con datos ya guardados:** el panel expandido muestra, de arriba a abajo:
1. Input "Peso de hoy" + botón guardar (actualiza el registro de hoy en `qg_weight_log`; si no hay registro de hoy, lo crea).
2. Link de meta: "🎯 poner meta" si no hay una puesta, o "🎯 {peso}kg para {fecha} · editar" si ya hay — abre un mini-formulario de 2 campos (peso objetivo, fecha) con opción de quitar la meta.
3. Resumen en texto (ver siguiente sección).
4. Gráfica SVG.
5. Badge de IMC, si hay `qg_height_cm` guardado.

## Línea teórica y resumen de progreso

La teórica es una recta entre `(fecha del primer registro, peso del primer registro)` y `(qg_goal_date, qg_goal_weight_kg)`. Sin meta puesta, no hay teórica — la gráfica y el resumen solo muestran lo real.

Resumen en texto, siempre presente si hay ≥1 registro:
```
Has bajado X.X kg desde el DD/MM (inicio: Y kg → hoy: Z kg)
```
(si `X` es negativo, o sea subió de peso, se muestra igual con signo — "Has subido X.X kg…" — sin ocultar ni distorsionar el dato)

Si hay meta y la fecha meta no ha pasado, segunda línea comparando el peso real de hoy contra el punto de la teórica en la fecha de hoy:
- Real ≤ teórica (para el caso de bajar de peso): `"Vas a tiempo"` si la diferencia es pequeña (≤0.3 kg), o `"Vas X.X kg adelantado"` si va mejor que la teórica.
- Real > teórica: `"Vas X.X kg atrasado respecto al plan"`.

Si la fecha meta ya pasó, esa segunda línea cambia a un resultado final: `"Meta cumplida 🎉"` (si llegó o pasó el peso objetivo) o `"No se alcanzó la meta — te quedaste a X.X kg"`.

## Gráfica (SVG, sin librerías)

- Un `<svg>` generado por JS a partir de `qg_weight_log` (y, si hay meta, los dos puntos de la teórica).
- Eje X: fechas, desde la del primer registro hasta la mayor entre "hoy" y `qg_goal_date` (si hay meta y es posterior a hoy). Eje Y: peso, autoescalado al rango real de los datos con un margen (~10%) arriba/abajo.
- Línea real: `<path>` sólido, color `var(--accent)` (así hereda el naranja o el color de modo arcoíris si está activo — mismo mecanismo que ya usa el resto de `index.html` vía la custom property).
- Línea teórica (si hay meta): `<path>` punteado (`stroke-dasharray`), color `var(--muted)`.
- Ejes simples: 2-3 marcas de peso en el eje Y (min/medio/max del rango mostrado), sin librería de fechas — solo `Date` nativo para formatear DD/MM.
- Con un solo registro (sin suficientes puntos para trazar línea): se omite la gráfica y solo se muestra el resumen de texto.

## IMC y badge

IMC = último `weightKg` de la bitácora / (`qg_height_cm`/100)². Bandas OMS:

| Rango | Color | Etiqueta |
|---|---|---|
| < 18.5 | 🔵 azul | Bajo peso |
| 18.5 – 24.9 | 🟢 verde | Normal |
| 25 – 29.9 | 🟠 naranja | Sobrepeso |
| ≥ 30 | 🔴 rojo | Obesidad |

Badge junto al resumen: `🟢 IMC 22.4 · Normal`. Sin `qg_height_cm` guardado, el badge no se muestra (nada que calcular) — no se fuerza a pedir estatura si el usuario no la dio en el primer registro.

## CSP

`index.html` no necesita ningún dominio nuevo — todo esto es JS/SVG inline, sin red, sin CDN. El CSP actual (`script-src 'self' 'unsafe-inline'`) ya lo cubre.

## Testing

- `node --check` sobre el bloque de script de `index.html` y sobre `correr.html` tras el cambio de fuente de peso.
- Assert-based check de la lógica pura: cálculo de la recta teórica dado un rango de fechas, clasificación de banda OMS dado un IMC, y el merge "sobrescribe si ya existe el registro de hoy" de `qg_weight_log` — mismo patrón que los checks ya existentes en `plan-engine.js`/`sync.js`.
- Regresión manual de `correr.html`: confirmar que el kcal calculado sigue funcionando igual leyendo de la bitácora compartida, y que editar el peso ahí se refleja en el registro de hoy visible desde `index.html`.
- Prueba manual completa en `index.html`: primer registro (peso+estatura) → aparece gráfica/resumen/badge → poner meta → confirmar recta teórica y mensaje de a tiempo/atrasado/adelantado → registrar varios días (se puede simular editando `qg_weight_log` a mano en devtools para probar rangos) → recargar y confirmar que todo persiste.
