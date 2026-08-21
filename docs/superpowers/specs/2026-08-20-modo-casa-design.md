# Modo "Casa" — diseño

## Objetivo
Agregar un modo de entrenamiento más junto a elíptica/caminadora/escaladora: circuito HIIT de ejercicios con peso corporal (sin equipo), reusando el motor de timer existente. Ampliar a otros equipos (mancuernas, ligas, etc.) queda fuera de este alcance — se resuelve después con el mismo mecanismo, cambiando el filtro `equipment`.

## Fuente de datos
Fetch en vivo (no se copian archivos al repo) a jsDelivr, anclado a un tag de versión:

```
https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/api/es/equipment/bodyweight.json
```

Se elige este repo (y no `hasaneyldrm/exercises-dataset`) porque está pensado explícitamente para consumo por apps externas vía CDN, sin copiar sus GIFs a nuestro repo. `exercises-dataset` trae medios con licencia de Gym visual (180×180 obligatorio, atribución obligatoria, y su propio NOTICE dice que redistribuir en otro proyecto requiere licencia directa de Gym visual) — se descarta para evitar ese riesgo.

Fetch se hace una vez al entrar a modo Casa (o al cambiar a él) y se cachea en memoria para la sesión. Si falla (sin internet): mensaje simple, modo Casa queda deshabilitado esa sesión, resto de la app no se afecta.

## Cambio de CSP (seguridad)
`index.html` tiene hoy:
```
connect-src 'none'; img-src 'self' data:;
```
Pasa a:
```
connect-src 'self' https://cdn.jsdelivr.net; img-src 'self' data: https://cdn.jsdelivr.net;
```
No se abre nada más (scripts externos, frames, forms siguen bloqueados).

## Motor del timer
Sin cambios: mismas duraciones (15/30/40 min), mismos niveles (fácil/medio/difícil/espartano), misma estructura de bloques (warm → ciclos mod/int/rec → cool).

Lo que cambia por bloque en modo Casa: en vez de `p1`/`p2` numéricos de máquina, cada bloque lleva un ejercicio elegido de la lista `bodyweight` filtrada por tipo de bloque (json trae `bodyPart`/`category` — se mapea heurísticamente: `category:cardio` o `bodyPart:cardio` → bloques moderados/intensos, `category:stretching` → bloques de recuperación/calentamiento/enfriamiento). Se rota sin repetir hasta agotar la lista disponible por tipo.

## UI en modo Casa
- Tarjeta actual (`current-card`) y modo gimnasio: muestran GIF + nombre del ejercicio en vez de los 2 `param-box` numéricos.
- Ajuste ± en vivo (`adjust-row`) y "Límites de tu máquina" (`calib-box`): ocultos — no aplican sin números de máquina.
- Selector de modo: se agrega "Casa" (🏠) al grid de "Equipo" existente (`machine-grid`), junto a elíptica/caminadora/escaladora.
- Estado de carga: mientras llega el fetch, tarjeta muestra "Cargando ejercicios…"; si falla, alerta y el botón "Casa" queda marcado como no disponible hasta reintentar (recargar la página).

## Fuera de alcance (después)
- Otros equipos que el usuario tiene (mancuernas, ligas, kettlebell, etc.) — mismo mecanismo, otro valor de `equipment` en el endpoint.
- Catálogo/librería de ejercicios explorable sin timer.
