Bullao · Menos bulla, cuentas claras

Bullao revisa facturas y cuentas de cobro para decidir cuáles pueden quedar listas para pago simulado, cuáles deben frenarse y cuáles necesitan autorización de una persona. Lo construimos para el reto de Blinka: que una empresa pueda delegar la revisión de sus cuentas sin perder el control sobre sus reglas ni la explicación de cada decisión.

Pensamos en empresas constituidas en Estados Unidos que trabajan con proveedores y contratistas de Latinoamérica. Una cuenta llega en PDF, por correo o como mensaje. Finanzas revisa el monto, busca lo acordado, comprueba si ya había llegado y pide permiso cuando algo no cuadra. Bullao reúne esa revisión en un flujo que puede usar un asistente de IA.

El asistente propone los datos de la factura y las citas que los respaldan. El motor de Bullao los contrasta con los proveedores registrados, los acuerdos vigentes, el límite por pago y el presupuesto disponible en cada moneda. Las decisiones financieras se calculan en código; el modelo no tiene permiso para cambiar las reglas ni autorizar excepciones.

Una cuenta que cumple queda lista para pago simulado y reserva su parte del presupuesto. Un duplicado, una moneda incompatible con el acuerdo o un presupuesto insuficiente frenan la aprobación. Si el cobro supera lo autorizado o falta información, Bullao explica qué necesita revisar una persona. Un visto bueno no puede reemplazar un monto inválido o evidencia faltante.

La demo muestra un caso que se repite en muchas empresas: un proveedor cobra más de lo acordado y recibe autorización "solo esta vez". Bullao vincula esa excepción a la cuenta correspondiente. Cuando llega el siguiente mes, vuelve a comprobar el acuerdo; el permiso anterior no se convierte en una tarifa permanente.

Cada decisión conserva sus comprobaciones, las citas del documento y la versión de las reglas utilizada. Se puede abrir la cuenta y entender qué pasó sin leer el código. El vencimiento aparece cuando existe evidencia explícita; una fecha de emisión no se toma como vencimiento y una fecha ausente se muestra como no indicada.

El prototipo incluye una empresa ficticia con sus acuerdos y reglas, documentos de ejemplo, lectura de XML y extracción de texto de PDF. Expone herramientas MCP con OAuth para consultar cuentas, revisar un borrador y enviar una factura leída desde un asistente compatible. La autorización de excepciones permanece en una pantalla autenticada. Los reintentos con la misma clave recuperan la cuenta registrada sin crear otra reserva.

La evaluación incluye casos normales y trampas: cobros duplicados, proveedores nuevos, montos fuera de acuerdo y presupuesto insuficiente. Las 88 pruebas automatizadas cubren el motor y los flujos implementados; no sustituyen la validación de cada integración externa.

Usamos únicamente datos ficticios. Bullao no ejecuta pagos, abre cuentas ni toma decisiones de fraude o cumplimiento. La demo termina con una decisión registrada y explicada, tal como pide Blinka.

Demo: https://bullao.vercel.app
