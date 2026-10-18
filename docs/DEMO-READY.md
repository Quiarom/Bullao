# Demo de Bullao: cierre y grabación

Web pública: https://bullao.vercel.app
MCP: https://bullao.vercel.app/mcp

## Grabación segura, sin configurar nada

1. Abre la web y pulsa **Ver demo**. El invitado tiene su propio registro ficticio.
2. Pulsa **Revisar la bandeja** y espera a que marque 0 sin revisar.
3. En **Listas**, abre una cuenta normal y muestra el documento y las comprobaciones.
4. En **No se pueden**, muestra un duplicado y el motivo del bloqueo.
5. En **Te esperan**, abre Hosting Andes: cobró USD 1.000 frente a USD 800 acordados. La persona puede autorizar solo esa cuenta; la autorización no es una nueva tarifa permanente. El registro conserva quién tomó la decisión.
6. Abre **Resultados**. En el ensayo público se observaron 21/21 casos del mes correctos y 4/4 casos adicionales correctos, con 0 aprobaciones fuera de las reglas en ambos conjuntos ficticios. No son métricas de clientes reales.

Guion corto: «Bullao revisa cuentas por pagar dentro de las reglas de una empresa. Esta cuenta cumple y queda lista para pago simulado. Esta otra es un duplicado y se frena. Aquí el proveedor cobra más de lo acordado: el agente pide permiso y deja la excepción vinculada a esta cuenta. Cada decisión conserva su explicación. No movemos dinero real».

## Demostración desde un asistente

Usa el cliente que ya probaste, reemplaza localhost por https://bullao.vercel.app/mcp y completa el login/consentimiento OAuth con tu propia cuenta. Si el proveedor abre Lovable, el servidor de autorización actual sigue usando su interfaz de consentimiento de Lovable. No confundir el acceso de invitado con una autorización MCP: el invitado no está permitido en MCP.

Prompt después de conectar:

> Revisa este documento ficticio con Bullao. Consulta los acuerdos, copia los datos y sus citas, comprueba el borrador y envíalo con una requestId estable. Devuélveme estado, razones y enlace a la cuenta; vuelve a consultar esa cuenta para confirmar el guardado. No autorices excepciones ni cambies reglas. Si falta información, dilo.

Adjunta public/examples/inv-01.pdf o pega su texto. La interpretación de PDF/OCR depende del asistente; Bullao no ofrece OCR universal.

## Estado operativo honesto

- Aplicación y servidor MCP publicados en Vercel, build correcto; metadata OAuth pública y acceso MCP sin token rechazado con 401.
- Motor, vencimientos y contrato MCP revisados independientemente. Suite de referencia actual: 88 pruebas.
- Ensayo real de la bandeja y lectura de Resultados en el host público completados con invitado. La captura de pantalla final agotó tiempo; la lectura del DOM y el archivo de evidencia sí se obtuvieron.
- Hermes tiene la conexión Bullao configurada, pero el consentimiento personal no se ha completado. El flujo observado redirige a una interfaz de Lovable. No se ha demostrado factura→MCP autenticado→respuesta en este chat.
- La lectura con IA de la web requiere LOVABLE_API_KEY/créditos del despliegue original; no se configuró una clave nueva en Vercel. XML y la demo precargada no usan ese gateway.
- No hay carpeta vigilada, activación conversacional de políticas ni integración OpenClaw probada. No mostrarlas como existentes.
- Todos los datos de demostración son ficticios; READY no significa pago ejecutado.
