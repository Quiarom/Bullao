# Cierre de Bullao — loop de hackathon

Base: 0fd0d91, rama finish/invoice-flow-polish. Preservar AGENTS.md y autenticación/OAuth/RLS existentes. No pagos reales, credenciales nuevas, datos reales de clientes ni reescritura de historial. No alterar expected.json ni holdout para conseguir verde.

- [ ] H1: revisar y endurecer el motor por las rutas reales de importación/MCP; casos adversariales de citas, moneda, periodo, duplicados y autorización. Test RED antes de corregir; mantener decisiones esperadas de los fixtures.
- [ ] H2: cerrar entrada documental: ejemplos ficticios descargables con procedencia, lectura de PDF textual acotada además de XML/texto, límites y estados honestos para escaneados/archivos inválidos. No descargar facturas reales de empresas.
- [ ] H3: aplicar audit → harden → polish de Impeccable al workspace existente: jerarquía, selección, móvil, foco y estados. Sin alterar decisiones/autenticación.
- [ ] H4: build/types/tests, inspección visual, prueba real del flujo de invitado y XML/PDF, comprobar endpoint MCP/OAuth sin reutilizar cookies personales ni inventar un login. Diferenciar lo probado por el usuario de la comprobación de esta sesión.
- [ ] H5: README/HANDOFF y evidencia de verificación; cambios en rama revisable, sin desplegar infraestructura externa ni publicar datos operativos.

## Propiedad de archivos

Padre: upload-dialog, lector PDF, ejemplos/procedencia, documentación e integración.
Worker motor: src/ap/{engine,money,upload,types} y regresiones propias. No XML/parser salvo fallo demostrado y aviso.
Worker diseño: accounts-workspace, account-detail, document, brand, styles y pruebas visuales/estado; NO upload-dialog, hooks, auth, MCP ni motor.
