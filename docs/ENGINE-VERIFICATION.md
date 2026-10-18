# Verificación del motor AP

## Alcance

Validación local del motor puro `src/ap/` en la rama `finish/invoice-flow-polish`, base `0fd0d91`. La entrada desde texto/MCP construye borradores `agent`; sus datos críticos (proveedor, número, monto, moneda y periodo) deben tener cita exacta que coincida con el valor usado. El periodo debe ser `YYYY-MM` con mes 01–12. Los importes con moneda explícita en conflicto con `currencyHint` fallan la comprobación de monto. Una aprobación humana conserva las excepciones de negocio para sobreprecio/límite, pero no convierte evidencia, periodo o importe inválidos en READY.

## Regresiones

`src/ap/security-regression.test.ts` cubre cita literal incongruente, citas omitidas/vacías en proveedor/moneda, periodo inválido y su preservación (sin sustituirlo silenciosamente por fallback), evidencia localizada mes+año en español/inglés, moneda explícita conflictiva y aprobación humana sobre evidencia y monto inválidos.

## Verificación ejecutada

- Antes de los cambios, la prueba de borrador no encontraba citas de proveedor/moneda/periodo y la aprobación humana convertía una cuenta con monto inválido y periodo malformado en READY (RED reproducido).
- Ejecución anterior tras añadir la regresión de periodo localizado: `npm exec --yes --package=bun -- bun run test`, 7 archivos y 67 pruebas pasaron.
- Reejecución actual: la suite completa tiene 8 archivos; 7 archivos/67 pruebas pasan y fallan 5 pruebas nuevas de `src/test/upload-dialog.test.tsx` porque buscan los tabs/labels PDF/XML no presentes en el diálogo concurrentemente editado. La regresión propia pasó: `npm exec --yes --package=bun -- bun x vitest run src/ap/security-regression.test.ts`, 1 archivo/5 pruebas.
- `NODE_OPTIONS=--max-old-space-size=1024 node_modules/.bin/tsc --noEmit`: pasó (exit 0).
- `git diff --check`: pasó (exit 0).

## Límites

La presencia literal y la igualdad cita/valor no demuestran semánticamente que la frase pertenece al campo correcto; sin parser estructurado o evidencia tipada de origen, texto ambiguo puede seguir siendo citado. Los borradores heredados `fixture` y los lectores XML conservan el comportamiento existente; esta corrección endurece `agent` y no cambia expected/holdout. La aprobación humana sigue permitiendo excepciones de sobreprecio/límite con evidencia y monto válidos; no es aprobación de pago real.
