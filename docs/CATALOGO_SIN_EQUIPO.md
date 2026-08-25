# Auditoría del catálogo "sin equipo" (bodyweight)

`rapido.html` y `entrenamientos.html` (Modo Casa) toman ejercicios del endpoint
`https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/api/es/equipment/bodyweight.json`
(458 ejercicios). Ese catálogo externo etiqueta el `equipment` como `"bodyweight"` de forma poco
confiable: varias entradas muestran en el GIF real una liga, correa, pelota, rodillo, máquina o
una segunda persona ayudando, aunque el texto (slug/nombre) no lo mencione. Ejemplo que originó
esta auditoría: `posterior-tibialis-stretch` ("Estiramiento del tibial posterior") — el texto no
dice nada de equipo, pero la imagen muestra una liga de resistencia enrollada en el pie.

**Regla del usuario (2026-08-25):** en Ejercicio Rápido y Modo Casa solo deben aparecer ejercicios
que usan únicamente el propio cuerpo. Quedan descartados: ligas/bandas, pelotas, máquinas,
rodillos, cuerdas, correas/toallas usadas como resistencia, mancuernas/discos/kettlebells, barras,
y cualquier ejercicio que requiera una segunda persona ayudando. Una pared de fondo para apoyo o
un escalón/piso normal SÍ se permiten (no son "equipo").

## Cómo se filtra (código)

En `rapido.html` y `entrenamientos.html` (duplicado idéntico en ambos, mismo patrón que ya existía
para el filtro de equipo — ver pendiente de esta duplicación en `docs/PENDIENTES.md`):

1. `NO_EQUIPMENT_RE` — filtro por palabras clave en slug+nombre (ball/pelota, bar/barra,
   pull-up/dominadas, roller/rodillo, rope/cuerda, strap/correa, towel/toalla, weighted, band/liga,
   resistance, mancuerna/dumbbell/kettlebell, máquina/machine/cable/trx, plate/disco, chair/silla,
   suspend, etc.)
2. `EXCLUDE_SLUGS` — lista curada a mano de slugs donde el texto no delata el equipo pero la
   imagen sí lo muestra (o requiere una segunda persona). Se arma revisando el `.thumb.webp` de
   cada ejercicio uno por uno.

## Metodología de la revisión visual

Para no tener que re-auditar las 458 imágenes cada vez que se toca este filtro: la lista de abajo
es el resultado de haber abierto cada thumbnail (`<muscle>/<slug>.thumb.webp` dentro de
`ExerciseGymGifsDB-main/ExerciseGymGifsDB-main/`) y clasificarlo a mano. Si el catálogo del CDN no
cambia de versión (`@v1.1.0`), esta lista sigue siendo válida — no hace falta volver a mirar las
458 imágenes, solo revisar ejercicios nuevos si se sube de versión el endpoint.

### Excluidos por imagen (no por texto) — confirmado visualmente

Auditoría completa de las 458 imágenes del catálogo `bodyweight.json` (@v1.1.0) hecha el
2026-08-25, repartida en 6 lotes revisados imagen por imagen. Resultado: **75 slugs** excluidos
por imagen aunque el texto no delate el equipo (11 de la primera pasada + 64 de la auditoría
completa), quedan **226 de 458** ejercicios realmente sin equipo.

| slug | qué se ve en la imagen |
|---|---|
| `posterior-tibialis-stretch` | liga de resistencia enrollada en el pie |
| `peroneals-stretch` | misma liga de resistencia en el pie |
| `assisted-side-lying-adductor-stretch` | segunda persona empujando la pierna |
| `assisted-lying-calves-stretch` | segunda persona sosteniendo la pierna |
| `assisted-lying-glutes-stretch` | segunda persona empujando la rodilla |
| `assisted-lying-gluteus-and-piriformis-stretch` | segunda persona empujando la rodilla |
| `assisted-prone-hamstring` | segunda persona asistiendo el estiramiento |
| `behind-head-chest-stretch` | segunda persona asistiendo el estiramiento |
| `self-assisted-inverse-leg-curl` | máquina de curl femoral nórdico (marco/almohadilla) |
| `self-assisted-inverse-leg-curl-on-floor` | mismo aparato, variante en piso |
| `self-assisted-inverse-leg-curl-1766` | mismo aparato, variante |
| `glute-ham-raise` | máquina GHR (banco con rodillo y respaldo) |
| `inverse-leg-curl-bench-support` | mismo tipo de máquina GHR |
| `45-side-bend` | banco romano/hiperextensión con anclaje de pies (aparato) |
| `decline-crunch` | banco declinado con anclaje de pies (aparato) |
| `decline-sit-up` | mismo banco declinado con anclaje |
| `incline-leg-hip-raise-leg-straight` | banco inclinado con anclaje de pies |
| `incline-twisting-sit-up` | mismo aparato inclinado con anclaje |
| `negative-crunch` | aparato con anclaje de pies |
| `assisted-lying-leg-raise-with-lateral-throw-down` | dos personas, asistido por pareja |
| `assisted-lying-leg-raise-with-throw-down` | dos personas, asistido por pareja |
| `assisted-motion-russian-twist` | dos personas + balón |
| `assisted-sit-up` | dos personas, asistido por pareja |
| `spell-caster` | sostiene un par de mancuernas |
| `twisted-leg-raise-female` | de pie en torre de dominadas con apoyabrazos (máquina) |
| `twisted-leg-raise` | misma torre/máquina |
| `wind-sprints` | elevación de piernas colgado de barra de dominadas |
| `box-jump-down-with-one-leg-stabilization` | requiere cajón pliométrico específico |
| `biceps-leg-concentration-curl` | sostiene una mancuerna (verificado a mano) |
| `run-equipment` | corriendo en caminadora (treadmill) |
| `stationary-bike-run-v-3` | bicicleta estática |
| `stationary-bike-walk` | bicicleta estática |
| `swing-360` | colgado de barra de dominadas |
| `standing-behind-neck-press` | barra con discos tras la nuca |
| `finger-curls` | barra con discos apoyada en un banco |
| `frankenstein-squat` | barra con discos sobre los hombros |
| `kneeling-jump-squat` | barra con discos sobre los hombros |
| `potty-squat-with-support` | aparato de sentadilla con manija de apoyo |
| `tire-flip` | neumático real de gimnasio |
| `power-clean` | barra olímpica con discos |
| `back-pec-stretch` | usa un rack/bastidor fijo como agarre |
| `seated-lower-back-stretch` | sentado en banco, sujeta barra fija elevada |
| `side-to-side-chin` | barra de dominadas visible |
| `twin-handle-parallel-grip-lat-pulldown` | máquina de jalón al pecho con polea y pesas |
| `assisted-chest-dip-kneeling` | máquina de fondos asistidos |
| `assisted-wide-grip-chest-dip-kneeling` | misma máquina de fondos asistidos |
| `chest-dip` | máquina de fondos asistidos con contrapeso |
| `drop-push-up` | manos apoyadas sobre dos mancuernas |
| `hands-bike` | máquina de gimnasio con stack de peso |
| `incline-reverse-grip-push-up` | marco de suspensión tipo TRX/anillas |
| `korean-dips` | barras paralelas de fondos |
| `dynamic-chest-stretch-male` | apoyado entre soportes elevados tipo equipo de gimnasio |
| `balance-board` | de pie sobre tabla de equilibrio |
| `farmers-walk` | sostiene un par de mancuernas |
| `snatch-pull` | barra olímpica con discos |
| `squat-jerk` | barra con discos sobre la cabeza |
| `hyperextension-on-bench` | banco de hiperextensión "silla romana" con reposapiés |
| `hyperextension` | mismo aparato de silla romana |
| `assisted-triceps-dip-kneeling` | máquina de fondos asistidos con contrapeso |
| `elbow-dips` | barras paralelas fijas (dip station) |
| `impossible-dips` | misma dip station |
| `incline-close-grip-push-up` | marco tipo rack/Smith machine |
| `ski-ergometer` | máquina de ski erg |
| `triceps-dip` | máquina de fondos asistidos con contrapeso (verificado a mano) |
| `triceps-press` | rack/máquina de cable |
| `bodyweight-squatting-row` | escalera de pared fija anclada (rack) |
| `bodyweight-standing-close-grip-one-arm-row` | misma escalera de pared |
| `bodyweight-standing-close-grip-row` | misma escalera de pared |
| `bodyweight-standing-one-arm-row` | misma escalera de pared |
| `bodyweight-standing-row` | misma escalera de pared (verificado a mano) |
| `inverted-row-bent-knees` | rack con barra |
| `inverted-row-on-bench` | Smith machine + banco |
| `inverted-row-v-2` | barra fija montada en poste |
| `inverted-row` | rack con barra |
| `skin-the-cat` | anillas de gimnasia colgadas de un marco (verificado a mano) |

### Casos borderline — se dejaron KEPT a propósito

Usan un banco/silla/caja simple como apoyo (no un aparato específico), tratados igual que la
convención ya existente de `CHAIR_TIP_RE` (banco sustituible por silla en casa): la familia de
fondos en banco (`bench-dip-*`, `one-arm-dip`, `triceps-dip-bench-leg`,
`triceps-dip-between-benches`, `three-bench-dip`, `reverse-dip`, `scapula-dips`,
`elbow-lift-reverse-push-up`), la familia de push-ups inclinados/declinados sobre caja o silla
(`incline-push-up`, `incline-push-up-on-box`, `incline-push-up-depth-jump`, `decline-push-up`,
`deep-push-up`, `push-up`, `raise-single-arm-push-up`, `wide-hand-push-up`, `sissy-squat`,
`incline-scapula-push-up`), y `one-leg-squat` (apoya el pie en una caja/step, igual que un
escalón). Si se quiere un criterio más estricto (ni banco ni caja), revisar estos.

## Cómo actualizar esta lista en el futuro

1. Bajar el JSON del endpoint (`equipment/bodyweight.json`, versión que esté usando el código).
2. Para cada entrada nueva (comparar contra la última auditoría), abrir el `.thumb.webp` local
   (si se tiene el repo `ExerciseGymGifsDB-main` clonado) o el `gifUrl`/`thumbUrl` remoto.
3. Si muestra cualquier objeto/aparato o una segunda persona ayudando → agregar el `slug` a
   `EXCLUDE_SLUGS` en **ambos** archivos (`rapido.html` y `entrenamientos.html`) y a la tabla de
   arriba con el motivo.
4. Si el endpoint sube de versión (`@v1.1.0` → otra), revisar si cambiaron slugs o imágenes antes
   de asumir que la lista sigue vigente.
