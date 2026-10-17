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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function UploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const extract = useServerFn(extractInvoice);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(draft: ReturnType<typeof draftFromXml>) {
    const { error } = await supabase.from("ap_events").insert({ kind: "review_invoice", payload: { draft } as never, actor: await actorName() });
    if (error) throw error;
    await qc.invalidateQueries({ queryKey: ["ap-events"] });
    onOpenChange(false); setText("");
    navigate({ to: "/cuentas", search: { cuenta: draft.id } });
  }

  async function fromText() {
    setBusy(true);
    try {
      const r = await extract({ data: { text } });
      if (!r.ok) { toast.error(r.message); return; }
      await save(draftFromFields(`up-${crypto.randomUUID()}`, text, r.fields, DATASET.company.month));
    } catch { toast.error("No pude leer la cuenta. No se guardó nada."); }
    finally { setBusy(false); }
  }

  async function fromXml(file: File) {
    setBusy(true);
    try {
      const xml = await file.text();
      await save(draftFromXml(`up-${crypto.randomUUID()}`, xml, DATASET.vendors));
    } catch (e) { toast.error(e instanceof XmlReadError ? e.message : "No pude leer ese XML."); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Subir una cuenta</DialogTitle>
          <DialogDescription>Bullao propone los campos con la frase exacta del documento. Si una frase no está en el texto, la cuenta pide tu visto bueno.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="texto">
          <TabsList><TabsTrigger value="texto">Pegar texto</TabsTrigger><TabsTrigger value="xml">Subir XML</TabsTrigger></TabsList>
          <TabsContent value="texto" className="grid gap-3">
            <Textarea rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder="Pega aquí la cuenta de cobro, el correo o el mensaje…" className="amount text-sm" />
            <Button onClick={fromText} disabled={busy || text.trim().length < 10}>{busy ? "Leyendo…" : "Leer y revisar"}</Button>
          </TabsContent>
          <TabsContent value="xml" className="grid gap-3">
            <p className="text-sm text-muted-foreground">CFDI 4.0 o factura electrónica DIAN. Se lee con un lector de XML, sin IA.</p>
            <input type="file" accept=".xml,text/xml,application/xml" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) fromXml(f); }}
              className="text-sm file:mr-3 file:rounded-md file:border file:bg-secondary file:px-3 file:py-1.5 file:font-bold file:text-secondary-foreground" />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
