import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DATASET, actorName } from "@/hooks/use-ap";
import { draftFromFields, draftFromXml } from "@/ap/upload";
import { XmlReadError } from "@/ap/xml";
import { extractInvoice } from "@/lib/extract.functions";
import { extractPdfText } from "@/lib/pdf-reader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function UploadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const extract = useServerFn(extractInvoice);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("texto");
  const [fileNote, setFileNote] = useState("");
  const [readError, setReadError] = useState("");

  async function save(draft: ReturnType<typeof draftFromXml>) {
    const { error } = await supabase
      .from("ap_events")
      .insert({ kind: "review_invoice", payload: { draft } as never, actor: await actorName() });
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ["ap-events"] });
    onOpenChange(false);
    setText("");
    setFileNote("");
    setReadError("");
    navigate({ to: "/cuentas", search: { cuenta: draft.id } });
  }

  async function fromText() {
    setBusy(true);
    try {
      const r = await extract({ data: { text } });
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      await save(
        draftFromFields(`up-${crypto.randomUUID()}`, text, r.fields, DATASET.company.month),
      );
    } catch {
      toast.error(
        "No pude completar la lectura o confirmar el guardado. Revisa la bandeja antes de reintentar.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function fromPdf(file: File) {
    setBusy(true);
    setReadError("");
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("El PDF supera el límite de 8 MB.");
      const result = await extractPdfText(new Uint8Array(await file.arrayBuffer()));
      setText(result.text);
      setFileNote(
        `${file.name} · ${result.pages} página(s). Texto extraído localmente; revísalo antes de enviarlo a la lectura con IA.`,
      );
      setTab("texto");
    } catch (e) {
      setReadError(
        e instanceof Error ? e.message : "No pude leer el PDF. Pega una transcripción revisada.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function fromXml(file: File) {
    setBusy(true);
    try {
      if (file.size > 2 * 1024 * 1024) throw new XmlReadError("El XML supera el límite de 2 MB.");
      await save(draftFromXml(`up-${crypto.randomUUID()}`, await file.text(), DATASET.vendors));
    } catch (e) {
      toast.error(
        e instanceof XmlReadError
          ? e.message
          : "No pude leer el XML o confirmar el guardado. Revisa la bandeja antes de reintentar.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Subir una cuenta</DialogTitle>
          <DialogDescription>
            Bullao propone los campos con citas del documento. El motor aplica las reglas; una
            aprobación humana no sustituye evidencia faltante.
          </DialogDescription>
        </DialogHeader>
        {readError && (
          <p role="alert" className="text-sm text-destructive">
            {readError}
          </p>
        )}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="texto">Pegar texto</TabsTrigger>
            <TabsTrigger value="pdf">Subir PDF</TabsTrigger>
            <TabsTrigger value="xml">Subir XML</TabsTrigger>
          </TabsList>
          <TabsContent value="texto" className="grid gap-3">
            {fileNote && (
              <p role="status" className="text-sm text-muted-foreground">
                {fileNote}
              </p>
            )}
            <label htmlFor="invoice-document-text" className="text-sm font-semibold">
              Texto de la cuenta
            </label>
            <Textarea
              id="invoice-document-text"
              rows={9}
              maxLength={20000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Pega aquí la cuenta de cobro, el correo o el mensaje…"
              className="amount text-sm"
            />
            <Button onClick={fromText} disabled={busy || text.trim().length < 10}>
              {busy ? "Leyendo…" : "Leer y revisar"}
            </Button>
          </TabsContent>
          <TabsContent value="pdf" className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              PDF con texto, hasta 8 MB y 10 páginas. Se extrae en tu navegador; seleccionarlo no lo
              guarda ni lo aprueba. Los escaneados requieren OCR y transcripción revisada.
            </p>
            <label htmlFor="invoice-pdf" className="text-sm font-semibold">
              Seleccionar PDF ficticio
            </label>
            <input
              id="invoice-pdf"
              type="file"
              accept=".pdf,application/pdf"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void fromPdf(f);
                e.target.value = "";
              }}
              className="min-h-11 text-base"
            />
            {busy && (
              <p role="status" className="text-sm">
                Extrayendo texto del PDF…
              </p>
            )}
          </TabsContent>
          <TabsContent value="xml" className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              CFDI 4.0 o factura electrónica DIAN, hasta 2 MB. Se lee con un lector XML, sin IA.
            </p>
            <label htmlFor="invoice-xml" className="text-sm font-semibold">
              Seleccionar XML ficticio
            </label>
            <input
              id="invoice-xml"
              type="file"
              accept=".xml,text/xml,application/xml"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void fromXml(f);
                e.target.value = "";
              }}
              className="min-h-11 text-base"
            />
          </TabsContent>
        </Tabs>
        <p className="text-xs text-muted-foreground">
          Solo datos ficticios.{" "}
          <a
            className="underline underline-offset-4"
            href="/examples/README.md"
            target="_blank"
            rel="noreferrer"
          >
            Guía y procedencia
          </a>{" "}
          ·{" "}
          <a
            className="underline underline-offset-4"
            href="/examples/bullao-documentos-demo.zip"
            download
          >
            Descargar ejemplos PDF, XML y texto
          </a>
        </p>
      </DialogContent>
    </Dialog>
  );
}
