import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workspace = readFileSync("src/components/bullao/accounts-workspace.tsx", "utf8");

describe("workspace review messaging and touch targets", () => {
  it("describes fixture processing honestly and does not simulate document reading", () => {
    expect(workspace).toContain("Procesamiento de demostración con datos ficticios");
    expect(workspace).toContain("Procesando demo…");
    expect(workspace).not.toContain('"Leyendo documento…"');
    expect(workspace).not.toContain("setTimeout((r) => setTimeout");
  });

  it("does not claim earlier reviews were lost when a later save fails", () => {
    expect(workspace).toContain("Las revisiones anteriores pueden haberse guardado");
    expect(workspace).not.toContain("nada se aprobó");
  });

  it("keeps the account detail selection and makes filters and rows touchable", () => {
    expect(workspace).toContain(
      "(selectedId ? all.find((d) => d.id === selectedId) : undefined) ?? rows[0]?.invoice",
    );
    expect(workspace).toContain('"h-auto min-h-11 min-w-0 whitespace-normal px-1 text-xs"');
    expect(workspace).toContain(
      '"h-auto min-h-11 w-full justify-start whitespace-normal rounded-none border-0 p-4 text-left"',
    );
  });
});
