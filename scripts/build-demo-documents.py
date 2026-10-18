"""Rebuild fictional demo downloads from the existing, frozen company fixtures.

No downloaded bills, private documents, external identity or fiscal signatures.
PDFs are one-page text documents using the standard Helvetica font.
"""
from pathlib import Path
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "examples"


def pdf(text):
    lines = ["BULLAO - DOCUMENTO FICTICIO / SIN VALIDEZ FISCAL", ""] + text.splitlines()
    commands = [b"BT /F1 11 Tf 48 790 Td 16 TL"]
    for line in lines:
        escaped = line.encode("cp1252", errors="replace").replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")
        commands.append(b"(" + escaped + b") Tj T*")
    commands.append(b"ET")
    stream = b"\n".join(commands)
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    result = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for i, obj in enumerate(objects, 1):
        offsets.append(len(result))
        result += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref = len(result)
    result += f"xref\n0 {len(objects)+1}\n0000000000 65535 f \n".encode()
    for offset in offsets:
        result += f"{offset:010d} 00000 n \n".encode()
    result += f"trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(result)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    docs = json.loads((ROOT / "src/demo/nodo-labs/inbox.json").read_text())
    expected = json.loads((ROOT / "src/demo/nodo-labs/expected.json").read_text())["inbox"]
    entries = []
    generated = []
    for doc in docs:
        extension = ".xml" if "xml" in doc else ".txt"
        name = doc["id"] + extension
        content = doc.get("xml", doc.get("text", ""))
        if extension == ".xml":
            content = content.replace("?>", "?>\n<!-- DOCUMENTO FICTICIO. SIN VALIDEZ FISCAL. -->", 1)
        else:
            content = "DOCUMENTO FICTICIO. SIN VALIDEZ FISCAL.\n\n" + content
        (OUT / name).write_text(content, encoding="utf-8")
        generated.append(name)
        entry = {"fixtureId": doc["id"], "channel": doc["channel"], "file": name, "expectedOriginalFixture": expected[doc["id"]]}
        if doc["channel"] == "PDF":
            pdf_name = doc["id"] + ".pdf"
            data = pdf(doc["text"])
            assert data.startswith(b"%PDF-") and data.endswith(b"%%EOF\n")
            (OUT / pdf_name).write_bytes(data)
            generated.append(pdf_name)
            entry["pdf"] = pdf_name
        entries.append(entry)
    manifest = {"synthetic": True, "source": "src/demo/nodo-labs/inbox.json", "limitations": "Expected labels refer to original fixtures and order; a reimport may correctly become duplicate or exceed remaining budget. XML samples are not signed fiscal documents.", "documents": entries}
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    generated.append("manifest.json")
    if (OUT / "README.md").exists(): generated.append("README.md")
    with zipfile.ZipFile(OUT / "bullao-documentos-demo.zip", "w", compression=zipfile.ZIP_DEFLATED) as z:
        for name in generated: z.write(OUT / name, name)
    with zipfile.ZipFile(OUT / "bullao-documentos-demo.zip") as z:
        assert z.testzip() is None
        assert set(z.namelist()) == set(generated)
    print(json.dumps({"documents": len(entries), "files": len(generated), "zip": str(OUT / "bullao-documentos-demo.zip"), "synthetic": True}))


if __name__ == "__main__":
    main()
