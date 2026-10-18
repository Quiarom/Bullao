# Documentos de ejemplo de Bullao

**Todos los documentos del ZIP son ficticios. No son facturas reales ni comprobantes fiscales válidos.** Los nombres, acuerdos y cifras pertenecen al dataset de demostración de Nodo Labs. No hay clientes de Blinka ni datos de una empresa real.

## Descargar y probar

- [Paquete completo PDF, XML y texto](./bullao-documentos-demo.zip)
- [Manifiesto de documentos y referencias a fixtures](./manifest.json)
- [Cuenta de cobro PDF ficticia](./inv-01.pdf)
- [CFDI XML ficticio](./inv-03.xml)
- [Correo ficticio en texto](./inv-02.txt)

PDF: abre «Subir una cuenta → Subir PDF». Bullao extrae el texto en tu navegador y lo muestra para revisión. Seleccionar el archivo no lo envía a IA, no lo guarda y no aprueba nada. «Leer y revisar» sí envía el texto al proveedor de IA ya configurado en la aplicación y guarda el borrador mediante tu sesión. Si no hay proveedor/créditos, no se simula una lectura exitosa. También puedes proporcionar el texto y sus citas a un asistente conectado por MCP.

XML: se lee con un parser determinista, sin IA. Solo variantes soportadas CFDI/DIAN. El XML genérico UBL no es automáticamente una factura DIAN ni se valida aquí una firma fiscal.

Los resultados del manifiesto corresponden al fixture original procesado en su orden. Reimportar una cuenta ya presente puede y debe resultar en duplicado; otras decisiones dependen del presupuesto y acuerdos vigentes. No cambies los resultados esperados para conseguir verde.

Límites de PDF: 8 MB, 10 páginas y 20.000 caracteres; no se acepta una lectura parcial. PDF escaneado/imagen, cifrado, corrupto o sin texto suficiente: obtener una transcripción/OCR revisado. No se implementa OCR en esta versión. El parser solo extrae texto, no renderiza acciones o scripts del PDF.

## Procedencia y referencias públicas

Investigamos formatos y ejemplos técnicos públicos, no descargamos cuentas de clientes:

- OASIS, ejemplos UBL 2.1: https://docs.oasis-open.org/ubl/os-UBL-2.1/xml/
- Ejemplo oficial UBL: https://docs.oasis-open.org/ubl/os-UBL-2.1/xml/UBL-Invoice-2.1-Example.xml
- SAT, guía de llenado CFDI global 4.0 (referencia de formato, no API de validación): http://omawww.sat.gob.mx/tramitesyservicios/Paginas/documentos/Guia_llenado_CFDI_global.pdf
- Código y fixtures originales: src/demo/nodo-labs/inbox.json y expected.json del repositorio Bullao, MIT.

Las referencias sirven para entender estructuras. Los archivos descargables se generan desde nuestros fixtures y no se atribuyen a SAT, DIAN, OASIS o Blinka. No incorporan sellos ni certificados auténticos.

## Regenerar

Desde el repositorio:

```sh
python3 scripts/build-demo-documents.py
```

El generador usa solo Python estándar. No cambia los fixtures ni sus etiquetas. Crea PDFs textuales, exportaciones XML/texto y ZIP; comprueba integridad y contenido del archivo comprimido.
