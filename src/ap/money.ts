export type Currency = "USD" | "COP" | "MXN" | "BRL";
export const CURRENCIES: Currency[] = ["USD", "COP", "MXN", "BRL"];
export type Money = { minor: number; currency: Currency };

export type ParsedAmount =
  | { ok: true; minor: number; currency: Currency | null }
  | { ok: false; reason: string };

/**
 * Parses LATAM / US amount strings into integer minor units.
 * Never uses floats for the value: digits are concatenated as strings.
 */
export function parseAmount(text: string, hint?: Currency): ParsedAmount {
  const raw = text.trim();
  let currency: Currency | null = null;
  if (/R\$/.test(raw) || /\bBRL\b/i.test(raw)) currency = "BRL";
  else if (/\bUSD\b|US\$/i.test(raw)) currency = "USD";
  else if (/\bCOP\b/i.test(raw)) currency = "COP";
  else if (/\bMXN\b/i.test(raw)) currency = "MXN";
  const num = raw.replace(/R\$|US\$|\$|USD|COP|MXN|BRL/gi, "").replace(/\s/g, "");
  if (!/^[0-9.,]+$/.test(num) || !/[0-9]/.test(num)) return { ok: false, reason: "no es un número" };

  const lastDot = num.lastIndexOf(".");
  const lastComma = num.lastIndexOf(",");
  let intPart: string;
  let decPart = "";

  if (lastDot >= 0 && lastComma >= 0) {
    const decSep = lastDot > lastComma ? "." : ",";
    const thouSep = decSep === "." ? "," : ".";
    const [i = "", d = ""] = num.split(decSep);
    if (num.split(decSep).length !== 2) return { ok: false, reason: "separadores confusos" };
    if (!validGroups(i, thouSep)) return { ok: false, reason: "separadores confusos" };
    intPart = i.split(thouSep).join("");
    decPart = d;
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? "." : ",";
    const parts = num.split(sep);
    const tail = parts[parts.length - 1] ?? "";
    if (parts.length > 2) {
      if (!validGroups(num, sep)) return { ok: false, reason: "separadores confusos" };
      intPart = parts.join("");
    } else if (tail.length === 3) {
      // "1.250" or "1,250": thousands in every supported locale unless the
      // hint says otherwise; a 3-digit tail is never cents.
      intPart = parts.join("");
    } else if (tail.length <= 2) {
      intPart = parts[0] ?? "";
      decPart = tail;
    } else {
      return { ok: false, reason: "separadores confusos" };
    }
  } else {
    intPart = num;
  }
  if (decPart.length > 2 || !/^\d*$/.test(decPart)) return { ok: false, reason: "decimales confusos" };
  const minor = Number(intPart || "0") * 100 + Number((decPart + "00").slice(0, 2));
  if (!Number.isSafeInteger(minor)) return { ok: false, reason: "monto fuera de rango" };
  return { ok: true, minor, currency: currency ?? hint ?? null };
}

function validGroups(s: string, sep: string) {
  const g = s.split(sep);
  const h = g[0] ?? "";
  return h.length >= 1 && h.length <= 3 && g.slice(1).every((x) => x.length === 3);
}

export function formatMoney(m: Money): string {
  const whole = Math.trunc(m.minor / 100);
  const cents = Math.abs(m.minor % 100);
  const w = Math.abs(whole).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${m.currency} ${m.minor < 0 ? "-" : ""}${w}${cents ? "," + cents.toString().padStart(2, "0") : ""}`;
}

export const usd = (n: number): Money => ({ minor: n * 100, currency: "USD" });
export const money = (n: number, currency: Currency): Money => ({ minor: n * 100, currency });
