# Bullao: operación agent-first

## Decisión de producto

La interacción principal es enviar una factura al asistente habitual y recibir una decisión explicada. La web queda para evidencia, auditoría y autorizaciones excepcionales; «Reglas» no es el onboarding obligatorio.

Hermes/OpenClaw aportan canales, runtime del agente y modelo configurado por su operador. Bullao aporta el motor financiero determinista, acuerdos/políticas persistidos, eventos y herramientas MCP. No construir otro gateway ni instalar ambos runtimes en este VPS para demostrar compatibilidad.

## Autoridad y fricción

- Una sola autorización inicial de política de empresa, expresada en lenguaje natural o documento separado y confiable. El agente propone una política estructurada y muestra su alcance antes de activarla. Esta activación conversacional NO está implementada todavía.
- Una factura no puede definir límites, añadir a su propio emisor a la lista permitida, aprobarse ni cambiar políticas. Si falta una política autorizada, procesar como revisión, no inventar un presupuesto.
- El agente lee, consulta acuerdos, comprueba y envía el borrador; el motor decide y registra. Caso normal: no exigir una confirmación por factura.
- Excepciones: enlace a aprobación autenticada existente. Una respuesta libre «sí» no es por sí sola una autorización verificable. Aprobación conversacional futura requiere identidad, cuenta/importe/moneda/versiones vinculados y protección contra reuso.
- No ejecutar pagos reales. READY significa lista/aprobada para pago simulado, nunca pagada ni programada en un banco.

## Recorrido objetivo

1. Conectar la cuenta de Bullao por OAuth una vez.
2. Validar la política de la empresa una vez, no extraer autoridad de las facturas.
3. Adjuntar PDF/XML o reenviar texto al asistente.
4. El runtime obtiene texto/evidencia con sus capacidades disponibles; no prometer OCR universal ni modelos gratuitos.
5. Consultar acuerdos y cuentas, usar check_invoice_draft y submit_invoice existentes.
6. Devolver estado, razones, presupuesto reservado, vencimiento explícito o «no indicado», y referencia a la cuenta.
7. Solicitar intervención solo si el motor la necesita. Si no hay evidencia suficiente, pedir corrección del documento; la aprobación no sustituye un dato inválido.

## Estado real

- Existente: MCP autenticado con consulta, comprobación y envío de borradores; autorización de excepciones en web; motor y eventos.
- Existente local: PDF textual en navegador y muestras sintéticas. Recibir un PDF por chat depende además del runtime/canal y su lector.
- En implementación separada: vencimiento explícito y evidencia en web/MCP/XML.
- Pendiente: política conversacional con confirmación y persistencia; conexión real y prueba de adjunto en Hermes; prueba independiente en OpenClaw; idempotencia del envío para reintentos del agente; publicación del conjunto.
- No realizado: instalación de OpenClaw, cambio de configuración de Hermes, nuevas credenciales, activación de servicios de pago o integración bancaria.

## Compatibilidad verificada documentalmente, no end-to-end

- Hermes documenta cliente MCP remoto HTTP y OAuth: https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp
- OpenClaw documenta mcp.servers, Streamable HTTP, OAuth y aislamiento per-requester: https://docs.openclaw.ai/gateway/config-extensions
- La configuración y el login son propios de cada runtime. Compartir protocolo no demuestra que el OAuth, los adjuntos o las identidades ya funcionen en ambos.
- Un gateway compartido no debe operar a todos los clientes con un token financiero único. Vincular identidad autenticada del remitente con su autorización de Bullao antes de habilitar escrituras.

## Criterio de entrega

Documento ficticio nuevo enviado en chat → extracción con evidencia → decisión del motor → evento persistido → lectura de vuelta → respuesta en el mismo chat. Repetir/reintentar no duplica reservas; un documento adversarial no cambia políticas; una excepción solo afecta la cuenta autorizada. Cerrar primero con Hermes y probar el mismo contrato después en OpenClaw, sin duplicar lógica financiera.
