# Verificación del flujo MCP

## Verificado localmente

Ejecución 2026-10-18, sin APIs live, credenciales ni base real:

- `npm run test -- --run src/test/mcp-agent-flow.test.ts`: PASS, 1 archivo, 9 pruebas.
- `NODE_OPTIONS=--max-old-space-size=1024 npm run test`: PASS, 10 archivos, 88 pruebas.
- `NODE_OPTIONS=--max-old-space-size=1024 npx tsc --noEmit`: PASS.
- `npx eslint src/lib/mcp/index.ts src/lib/mcp/state.ts src/lib/mcp/tools/check-draft.ts src/lib/mcp/tools/get-invoice.ts src/lib/mcp/tools/submit-invoice.ts src/test/mcp-agent-flow.test.ts`: PASS.
- `git diff --check -- src/lib/mcp src/test/mcp-agent-flow.test.ts`: PASS.
- `npx eslint src/lib/mcp src/test/mcp-agent-flow.test.ts`: FAIL por formato Prettier preexistente en `tools/list-agreements.ts` y `tools/list-invoices.ts`, fuera de los cambios de este flujo.
- `NODE_OPTIONS=--max-old-space-size=1024 npm run lint -- --no-warn-ignored`: FAIL por 443 errores Prettier del repositorio; no se modificó formato ajeno.
- `bun` no está disponible en PATH; se usó el runner Vitest existente vía npm.

Los handlers reutilizan `draftFromFields`, así que las citas requeridas por el motor se generan de forma coherente en preview y submit. `submit_invoice` acepta `requestId` opcional; el id del evento deriva de `userId + NUL + requestId` mediante SHA-256 y UUID determinista, aprovechando la PK existente de `ap_events` para arbitraje concurrente. En conflicto, lee el evento bajo el usuario autenticado y compara clave/fingerprint antes de responder como replay. Sin clave conserva ID aleatorio.

La respuesta de envío incluye id, outcome, reasons, dueDate explícita o null, replay y enlace relativo `/cuentas?cuenta=…`; `get_invoice` devuelve la ficha correspondiente. El servidor MCP se identifica como Bullao. La inspección de herramientas en `src/lib/mcp/**` encontró consultas, preview y submit, no herramientas para aprobar o programar/pagar. No se alteró auth/OAuth.

## Casos en pruebas de handlers reales

`src/test/mcp-agent-flow.test.ts` invoca handlers reales con el adaptador `supabaseForUser` simulado:

- Feliz/READY: preview no escribe, submit crea y devuelve resultado accionable, lectura posterior recupera la cuenta.
- Duplicado sin requestId: crea segundo evento, el motor bloquea el duplicado y replay deja una reserva.
- Faltan evidencia/citas: REVIEW, sin reserva; vencimiento sin cita no se acepta.
- Usuario no autenticado y sesión invitada: rechazo antes de persistir.
- Retry concurrente: una fila para dos llamadas idénticas y una respuesta replay.
- Retry secuencial con orden de claves invertido: mismo ID y replay.
- Conflicto de clave con payload diferente: rechazo.
- Aislamiento cross-user: misma requestId en otro usuario crea evento independiente y no es replay.
- Schema: requestId, vencimiento y campos extendidos siguen siendo opcionales para llamadas anteriores.
- Preview y submit coinciden para periodo localizado y vencimiento con cita explícita.

La tarjeta upstream reporta RED real previo: mismo payload con propiedades reordenadas se rechazaba como conflicto; la canonicalización recursiva lo corrigió. Aquí se reprodujo la prueba actual `treats the same effective payload as identical regardless of object key order` en GREEN. No se volvió a ejecutar la versión anterior para reproducir RED en esta revisión.

## Límites

El mock modela conflicto de inserción única y filtrado por `user_id`; no verifica PostgreSQL multi-proceso, RLS/OAuth reales, errores de red/transacción ni despliegue. No hay índice único independiente en requestId: la exclusión depende de la PK UUID derivada de usuario y clave. Tampoco se prueban colisiones criptográficas ni integración real Hermes/OpenClaw. No hubo llamadas live ni se usaron credenciales.
