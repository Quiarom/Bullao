# Verificación de fecha de vencimiento

Bullao solo conserva `dueDate` cuando la lectura propone una fecha explícita `YYYY-MM-DD` y su cita literal la contiene. El motor valida que sea una fecha calendario real y que la cita aparezca en el documento; si se informó una fecha inválida o una cita incongruente, la comprobación de evidencia falla. Si no aparece, el valor es `null` y la ficha/MCP muestran “No indicado”. La fecha de emisión y el periodo facturado no se convierten en vencimiento.

Los lectores XML solo toman los campos inequívocos `Comprobante@FechaVencimiento` (CFDI) y `PaymentDueDate` (DIAN), nunca `Fecha` o `IssueDate`. Los eventos y facturas anteriores que no tengan `dueDate` siguen siendo válidos.

Las pruebas de Vitest son pruebas unitarias locales: no hacen llamadas live al proveedor de IA, no verifican una integración con Hermes/OpenClaw y no realizan pagos. La extracción web usa el flujo de lectura ya existente; no hay prueba live de ese proveedor en esta verificación.
