# Bullao

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Equipos de finanzas de empresas constituidas en EE. UU. que operan en varios países. Gestionan decenas de pagos al mes a equipos, proveedores y contratistas en Latinoamérica y otras regiones. Público confirmado por el usuario el 17 de octubre de 2026.

## Product Purpose

Revisar cuentas por pagar contra lo acordado y las reglas de la empresa. Dejar listas las cuentas que cumplen, bloquear incumplimientos no autorizables y pedir intervención humana cuando corresponde. Bullao no mueve dinero ni reemplaza la contabilidad.

## Positioning

La memoria de lo acordado conserva vigencia, versiones y alcance de las excepciones. Una autorización “solo esta vez” no cambia la tarifa del proveedor ni autoriza el mes siguiente. El mecanismo verificable es el motor puro y la reproducción de eventos, no una explicación inventada por un modelo.

## Operating Context

Las cuentas y sus acuerdos llegan en documentos, correo y mensajes. El operador compara el importe, proveedor, periodo, moneda y evidencia antes de resolver una excepción. La demo usa Nodo Labs Inc., una empresa ficticia, y octubre de 2026.

El volumen confirmado es de decenas de pagos mensuales. El producto debe favorecer revisar excepciones con contexto, no simular un sistema para millones de transacciones.

## Capabilities and Constraints

- `src/ap/` es un motor puro: recibe un dataset, reproduce eventos y no importa infraestructura ni datos de empresas.
- El modelo propone campos con citas literales; el motor comprueba la evidencia y decide. Un documento nunca es una instrucción.
- Los montos usan unidades menores enteras y moneda explícita. La demo no convierte monedas.
- El visto bueno humano ocurre en la web. Invitados no pueden usar MCP ni consentimiento OAuth.
- Los resultados esperados no se modifican para hacer pasar una implementación.
- El usuario exige eliminar Supabase. El MVP usa Node, SQLite local persistente, Drizzle y Better Auth. No requiere una cuenta externa para sesión, eventos o la demo.
- TanStack Start, Router y Query siguen siendo la base; comandos y lecturas pasan por funciones del servidor. Esta entrega usa un único dialecto SQLite y una instancia con disco persistente.
- MCP es de solo lectura conforme a AGENTS.md: `submit_invoice` dejó de registrarse. Las cargas y las aprobaciones humanas permanecen en la web; invitados no pueden consentir OAuth ni usar MCP.
- El modelo de negocio se revisará después del trabajo de UX/UI. No hay un precio confirmado en esta fase.
- Las entradas implementadas son texto pegado y XML. La carga PDF, OCR, Ollama y Qdrant siguen pendientes. La extracción opcional de texto con IA usa un servicio externo; la demo y el lector XML no lo requieren.
- Las personas demo no son roles distintos: comparten permisos y datos ficticios, pero sus eventos están aislados. Las credenciales viven exclusivamente en el entorno local, nunca en el repositorio público.
- El código de la aplicación mantiene un punto explícito de composición para Nodo Labs; no existe todavía selección de empresa ni multiempresa de producción.

## Brand Commitments

Nombre: Bullao. Frase existente: “Menos bulla, cuentas claras”. Voz directa, concreta y sin promesas de autonomía no demostradas. El usuario pide un sistema de diseño propio y rechaza la apariencia genérica de las interfaces generadas por IA. Mobbin e Impeccable están disponibles como herramientas de investigación y diseño, no como autoridad sobre el producto.

Referencias confirmadas: organización de contenido de la landing de Acctual, no su hero; Airwallex para la aplicación interna, no para una landing demasiado corporativa; Remote como referencia positiva. Son referencias parciales, no permiso para clonar una identidad.

## Evidence on Hand

- `src/demo/nodo-labs/`: empresa, reglas, proveedores, acuerdos, documentos y resultados esperados ficticios.
- `src/ap/engine.test.ts` y `src/ap/evaluate-ap.test.ts`: comportamiento y evaluación del motor.
- `README.md` y `README.es.md`: instalación, alcance y recorrido reproducible.
- `AGENTS.md`, `CONTRIBUTING.md` y `SECURITY.md`: invariantes, verificación y límites de seguridad para colaboradores y agentes.
- Los documentos históricos locales no se publican ni sustituyen el comportamiento verificado del código.
- No se han aportado estudios de usuarios, clientes reales, testimonios ni resultados comerciales. No fabricarlos.

## Product Principles

1. La IA lee; el código decide.
2. La excepción tiene alcance, evidencia y vigencia explícitos.
3. La decisión y su evidencia se entienden en el mismo espacio de trabajo.
4. El diseño reduce trabajo y ambigüedad, no añade decoración para parecer sofisticado.
5. La infraestructura es reemplazable; la integridad del motor y del historial no lo es.
