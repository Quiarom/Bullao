# Bullao

**Menos bulla. Cuentas más claras.** Bullao es una demo de código abierto para revisar cuentas por pagar. Compara los datos de una cuenta con los acuerdos y reglas del proveedor, y muestra qué está listo, qué requiere a una persona y qué está bloqueado.

Bullao es un MVP de hackathon con datos ficticios de Nodo Labs. No mueve dinero. Licencia [MIT](LICENSE) · [English](README.md)

## Inicio rápido

Requiere Node.js 24 o posterior y pnpm 11 o posterior. La demo local usa SQLite. No requiere Supabase, Docker, modelos ni servicios externos.

```bash
pnpm install
pnpm run setup
pnpm dev
```

Abre <http://localhost:8080> y elige **Ver la demo de Nodo Labs**. `pnpm run setup` crea `.env.local` con una clave local de autenticación si el archivo no existe. Mantén ese archivo privado.

## Prueba la demo

1. Abre la bandeja y elige **Revisar la bandeja** para procesar los 21 documentos ficticios.
2. Revisa estados, citas de evidencia, acuerdos, reglas y resultados de evaluación.
3. Busca Hosting Andes en octubre. Su cuenta de USD 1.000 supera el acuerdo de USD 800 porque el adicional de mayo ya se usó.
4. Elige **Dar el visto bueno solo esta vez**. La excepción aplica solo a octubre.
5. Abre la cuenta de noviembre. Pide aprobación otra vez. Cambiar el acuerdo a USD 1.000 desde noviembre afecta noviembre, no la decisión registrada de octubre.

Cada cuenta con sesión propia tiene su historial de eventos sobre los mismos datos ficticios. Las cuentas de demo representan tareas, no roles de autorización distintos; todas tienen los mismos permisos.

## Lo que funciona hoy

- El motor puro en `src/ap/` evalúa reglas y acuerdos, valida citas de evidencia y reconstruye el estado desde eventos de solo inserción.
- Los datos de demo y resultados esperados viven en `src/demo/nodo-labs/`. Son una línea base fija de evaluación, no una garantía de precisión en casos reales.
- La web incluye la bandeja ficticia y carga manual de texto pegado o XML (lectores CFDI 4.0 y DIAN UBL).
- MCP está disponible en `/mcp`. Sus herramientas leen cuentas o previsualizan un borrador. Una persona da consentimiento OAuth en la web; las sesiones anónimas no pueden conectarse.
- Consulta [CONTRIBUTING.md](CONTRIBUTING.md) para límites de código y verificaciones. Consulta [SECURITY.md](SECURITY.md) para reportar problemas de seguridad.

## Límites y seguridad

- No hay pagos reales, acceso bancario, integración contable, ingesta de correo/WhatsApp ni carga/OCR de PDF.
- No hay Qdrant ni Ollama. `LOVABLE_API_KEY` es opcional para extraer campos de texto pegado; no se necesita para fixtures ni XML. El motor verifica los valores extraídos contra citas del documento.
- No hay roles de equipo ni políticas de acceso más allá del aislamiento por cuenta. Las cuentas de demo tienen los mismos permisos.
- La app crea `data/bullao.sqlite`. Esta configuración local requiere disco persistente y una sola instancia; no la uses tal cual en un despliegue multi-instancia.
- No se ha probado la interoperabilidad MCP con clientes externos más allá del flujo OAuth/PKCE verificado localmente. Para uso remoto, publica detrás de HTTPS y conserva `BETTER_AUTH_SECRET` junto con la base de datos.

Regla central: **la IA lee; el código decide; una persona aprueba.** Los documentos son datos no confiables, el dinero usa enteros en unidades menores con su moneda ISO, y MCP nunca ejecuta aprobaciones humanas.

## Verificaciones de desarrollo

```bash
pnpm run check
pnpm build
```

`pnpm run check` ejecuta el escaneo de secretos para candidatos de publicación, lint, typecheck y pruebas. El escaneo es una protección, no una auditoría completa. `pnpm start` sirve localmente la compilación de producción.

## Mapa del proyecto

```text
src/ap/                 Motor puro de decisiones y pruebas
src/demo/nodo-labs/     Datos ficticios y línea base de evaluación
src/lib/mcp/            Herramientas MCP OAuth de solo lectura
src/routes/             Rutas web
src/server/             Autenticación, SQLite y eventos de solo inserción
```
