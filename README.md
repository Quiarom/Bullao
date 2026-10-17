# bullao

**Menos bulla, cuentas claras.**

Bullao revisa las cuentas que te llegan por correo, PDF o WhatsApp, las compara con lo acordado con cada proveedor, deja listo lo que cumple y te trae solo lo que necesita tu visto bueno.

Cuando autorizas algo "solo esta vez", sabe que fue solo esta vez.

Demo para el reto Blinka del 30X Hackathon. Datos ficticios. No mueve dinero. Licencia [MIT](./LICENSE).

---

## Correrlo

```bash
bun install
bun run dev        # http://localhost:8080
bunx vitest run    # pruebas
```

Necesita un proyecto de Lovable Cloud (o Supabase) con la tabla `ap_events` de `drizzle/migrations/`.

## Cómo se usa

1. **Ver la demo de Nodo Labs**: entra como invitado, sin crear cuenta. Cada invitado tiene su propio octubre.
2. **Bandeja**: los 21 documentos tal como llegaron (cuenta de cobro, correo, WhatsApp, CFDI, factura DIAN). **Revisar la bandeja** los procesa uno por uno.
3. **Cuentas**: "Revisé 21 cuentas. 9 quedaron listas, 8 te esperan, 4 no se pueden aprobar."
4. **Ficha**: estado, monto, lo acordado, comprobaciones y la frase exacta del documento en amarillo.
5. **Reglas**: presupuesto, límite por pago y tolerancia. Antes de guardar muestra qué cuentas cambian.
6. **Resultados**: la prueba honesta, en vivo.
7. **Subir una cuenta**: pega texto (la IA propone campos con su cita y el motor verifica cada cita) o sube un XML (lector propio, sin IA).

### La escena de Hosting Andes

1. Hosting Andes cobra USD 1.000 en octubre. Lo acordado es USD 800; el adicional de mayo ya se usó. Resultado: necesita tu visto bueno.
2. **Dar el visto bueno solo esta vez** autoriza USD 200 únicamente para octubre.
3. **Llegó la cuenta de noviembre**: vuelve a pedir visto bueno.
4. En **Lo acordado**, aprobar la tarifa de USD 1.000 desde noviembre deja lista la cuenta de noviembre. Octubre se conserva tal cual en el registro.

## Prueba honesta (salida real de `bunx vitest run`)

```text
Casos visibles
  Decisiones correctas: 21 de 21
  Pagos aprobados fuera de las reglas: 0
  Decididas sin pedir ayuda: 13 de 21
  Te consultó: 8 de 21
Casos que Bullao no había visto
  Decisiones correctas: 4 de 4
  Pagos aprobados fuera de las reglas: 0
  Decididas sin pedir ayuda: 2 de 4
  Te consultó: 2 de 4
 Test Files  4 passed (4)
      Tests  53 passed (53)
```

Los resultados esperados viven en `src/demo/nodo-labs/expected.json`. Se escribieron antes de programar y no se ajustan para que una implementación pase.

## Piezas

```text
src/ap/             Motor puro: sin red, sin base de datos, sin Lovable
  money.ts          Montos LATAM → centavos enteros (parseAmount)
  xml.ts            Lectores CFDI 4.0 y DIAN UBL (fast-xml-parser)
  engine.ts         evaluate, buildState (reproduce eventos), previewRules, verifyQuotes
  evaluate.ts       Reporte contra lo esperado
src/demo/nodo-labs/ Datos de la empresa ficticia en JSON (reemplazables)
src/lib/mcp/        Servidor MCP con OAuth
src/routes/         Pantallas
```

El estado no se guarda: se guardan **eventos** solo de inserción (`review_invoice`, `approve_invoice`, `update_rules`…) y el motor reconstruye el mes. Cambiar reglas o acuerdos crea una versión nueva; las decisiones pasadas conservan la suya.

**Reglas de seguridad:**
- La IA lee, el código decide.
- Cada dato necesita su cita exacta en el documento.
- El documento es dato, nunca instrucción.
- Dinero en enteros con su moneda ISO, sin conversión.
- El visto bueno lo da una persona, solo en la web.

## Conectarlo a Claude u otro asistente (MCP)

Después de publicar, agrega un conector MCP personalizado con la URL `https://<tu-app>/mcp`. El asistente abre la pantalla de permiso de Bullao y tú entras con tu cuenta real; los invitados no pueden usar el MCP.

Herramientas: `list_invoices`, `get_invoice`, `list_agreements`, `check_invoice_draft` (vista previa) y `submit_invoice` (guarda una cuenta leída; el motor verifica las citas y decide). No existe ninguna herramienta para aprobar, pagar o borrar.

## Modelo de negocio

- **Open core:** el motor, la web y el MCP son abiertos (MIT). Cualquiera puede instalarlo y revisar cómo decide.
- **Versión en la nube:** para equipos de finanzas que no quieren instalar nada, con conectores contables y varios aprobadores.
- **Alianza con plataformas de pago:** Bullao es la revisión antes del pago; la plataforma mueve el dinero después. Se ofrece integrado a sus clientes.

## Qué queda fuera

- Pagos reales: nunca.
- Integración con programas contables.
- Búsqueda semántica (Qdrant): nunca concedería permiso de pago, solo ayudaría a encontrar contratos.

---

Bullao nació del repo IntraHilo, un radar de contenido; este MVP se rehízo desde cero sobre TanStack Start y Lovable Cloud.
