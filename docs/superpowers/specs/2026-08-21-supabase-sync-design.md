# Sync entre dispositivos con Supabase — Diseño

**Fecha:** 2026-08-21
**Estado:** aprobado, pendiente de plan de implementación

## Contexto y motivación

`quemagrasa` es hoy una app 100% estática (HTML+JS puro, sin build step, servida en GitHub Pages). Cada página guarda su propio estado en `localStorage` del navegador, aislado por dispositivo:

- `correr.html` — historial de carreras/caminatas (`correr_history`: array de `{date, mode, distanceM, elapsedS, steps, kcal}`, sin coordenadas GPS — solo se usan en memoria para el mapa en vivo, nunca se persisten) y peso corporal (`correr_weight`, un solo número).
- `entrenamientos.html` — progreso del plan de 30 días: nivel elegido, día actual, set de días completados.
- `rapido.html`, `index.html` — sin datos propios que sincronizar.

Motivación: sincronizar este progreso entre dispositivos del mismo usuario. Hoy si cambias de celular o borras datos del sitio, se pierde todo.

## Arquitectura

**Sin build step nuevo.** Se usa `@supabase/supabase-js` cargado como `<script type="module">` vía CDN, igual patrón que el `fetch` existente al CDN de ejercicios (`EX_URL`). Se descartó agregar un bundler: no hay beneficio que justifique el cambio de flujo de trabajo de esta app.

**Módulo compartido nuevo: `sync.js`.** Un solo archivo cargado por `correr.html` y `entrenamientos.html` (no por `rapido.html` ni `index.html`, que no tienen datos propios). Contiene: cliente Supabase, login por magic link, funciones de pull/push/merge. Evita el tipo de duplicación que causó el bug de `NO_EQUIPMENT_RE` (commit `dd906d4`) — un solo lugar para esta lógica, no copiado por página.

**Autenticación: magic link por email.** Vía `supabase.auth.signInWithOtp({ email })`. La sesión la persiste `supabase-js` en su propio `localStorage` — se inicia sesión una vez y las demás páginas del mismo origen la ven automático, sin nada propio que sincronizar entre pestañas/páginas.

**"Fuerza autenticación de servidor" (requisito original del usuario) — cómo se cumple:** no hay servidor propio (Node/Express). Postgres con RLS corre del lado del servidor de Supabase y valida el JWT del usuario en cada consulta — el cliente nunca puede leer/escribir filas ajenas aunque manipule el JS del navegador. Esa validación server-side de Postgres **es** la autenticación forzada del lado servidor. La `anon key` pública solo identifica un cliente legítimo del proyecto; no otorga acceso por sí sola, RLS lo hace.

**Login opcional, `localStorage` sigue siendo el default.** Sin cuenta: la app funciona exactamente igual que hoy, 100% local, cero llamadas a Supabase. Con cuenta: sincroniza en segundo plano. Nadie pierde funcionalidad por no registrarse o por estar sin internet.

## Esquema de datos y RLS

Sin tabla `profiles` — no hace falta, se usa `auth.users(id)` de Supabase Auth directo como `user_id`.

```sql
-- Historial de carreras/caminatas: log completo, un registro por sesión
create table run_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) default auth.uid(),
  date timestamptz not null,
  mode text not null,          -- 'correr' | 'caminar'
  distance_m numeric not null,
  elapsed_s numeric not null,
  steps int,
  kcal numeric,
  created_at timestamptz not null default now()
);

-- Peso corporal + progreso del plan: una sola fila por usuario, se sobreescribe
create table user_state (
  user_id uuid primary key references auth.users(id) default auth.uid(),
  weight_kg numeric,
  plan_level text,             -- entrenamientos.html KEY_LEVEL
  plan_current_day int,        -- KEY_CURRENT
  plan_completed_days int[],   -- KEY_DONE como arreglo
  updated_at timestamptz not null default now()
);

alter table run_history enable row level security;
alter table user_state enable row level security;

create policy "own rows only" on run_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own row only" on user_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

`for all` cubre select/insert/update/delete con la misma regla: un usuario nunca ve ni toca la fila de otro usuario.

**Cifrado:** ninguno a nivel de campo. TLS en tránsito + cifrado en reposo (default de Supabase) + RLS por fila es suficiente para este tipo de dato (peso, minutos corridos, días de plan completados — no es dato médico ni financiero). Cifrado app-level fue evaluado y descartado: agrega manejo de llaves sin beneficio real, y si se pierde la llave el usuario pierde sus datos para siempre.

## Estrategia de sync

**`run_history` (log, append-only):**
1. Al iniciar sesión: trae todas las filas remotas, une con las locales (dedupe por `date`+`mode`+`distanceM`, ya que hoy no hay id local). Lo que exista solo en local se sube. El resultado combinado se re-escribe en `localStorage`.
2. De ahí en adelante: cada carrera nueva (`saveHistoryEntry`) se guarda local **y** se inserta a Supabase al mismo tiempo, si hay sesión activa.

**`user_state` (peso + progreso del plan, fila única):**
1. Cada vez que se abre la app con sesión activa (no solo la primera vez): si existe fila remota, **remota gana** y sobreescribe lo local de ese dispositivo. Si no existe fila remota, se sube la local. Se revisa en cada apertura — así un dispositivo que estuvo cerrado mientras otro hacía cambios no pisa esos cambios más nuevos al volver a abrirse.
2. Además: cada cambio (peso nuevo, día completado, cambio de nivel) hace upsert inmediato a Supabase mientras haya sesión activa.

**Sin sesión:** cero llamadas a Supabase, comportamiento idéntico al actual.

## UI de login

Botón "☁️ Sincronizar" en el topbar de `correr.html` y `entrenamientos.html`, junto al `⚙` existente. Abre un modal mínimo:

`email` → "Enviar link" → estado "revisa tu correo" → usuario toca el link en su correo → vuelve a la app con sesión activa (detectada automático por `supabase-js`) → botón cambia a "☁️✓" (tocarlo de nuevo = cerrar sesión).

Quien no toque el botón nunca dispara ninguna llamada a Supabase.

## CSP (Content-Security-Policy)

Ambas páginas tienen CSP restrictivo hoy y hay que ampliarlo, si no las llamadas a Supabase se bloquean solas:

- `correr.html`: `connect-src 'none'` (bloquea toda red) y `script-src` no incluye ningún CDN de Supabase.
- `entrenamientos.html`: `script-src 'self' 'unsafe-inline'` (sin CDNs) y `connect-src` solo permite `https://cdn.jsdelivr.net`.

Cambio necesario en ambas: agregar `https://esm.sh` a `script-src` (de ahí se importa `@supabase/supabase-js` dinámicamente) y `https://*.supabase.co` a `connect-src` (REST + Auth del proyecto). El resto de las directivas no cambia.

## Setup (una vez, fuera del código)

- Crear el proyecto en supabase.com (manual, requiere la cuenta del usuario) y correr el SQL de arriba.
- `anon key` + URL del proyecto como constantes literales en `sync.js` — es correcto que sean públicas, ese es su diseño; la seguridad la da RLS, no el secreto de esta clave.
- En el dashboard de Supabase: configurar la Redirect URL de Auth apuntando a la URL de GitHub Pages de la app.

## Fuera de alcance (deferred)

- Cola de reintentos si falla la subida por estar offline — el cambio queda bien guardado en local, pero no llega a la nube hasta el siguiente guardado exitoso con internet. Se agrega si en la práctica causa pérdida de datos entre dispositivos.
- Cifrado a nivel de campo.
- Login con Google/OAuth.
- Borrar cuenta / exportar datos.
- Compartir progreso entre usuarios / features sociales.
- Tabla `profiles` con datos de perfil adicionales.

## Testing

- `node --check` sobre `sync.js` y las páginas modificadas.
- Prueba manual en navegador: login por magic link (dos pestañas simulando dos "dispositivos" con distinto estado local), verificar que el merge de `run_history` no duplica ni pierde entradas, y que `user_state` converge según la regla "remota gana en primer login".
- Confirmar que sin sesión iniciada, cero requests de red a Supabase (revisar con `read_network_requests` o la pestaña Network).
