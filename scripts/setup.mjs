import { randomBytes } from "node:crypto";
import { chmod, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

export const personas = [
  ["OPERATIONS", "operaciones@demo.bullao.test", "Operaciones de cuentas por pagar"],
  ["FINANCE", "responsable@demo.bullao.test", "Responsable de finanzas"],
  ["CONSULTANT", "consulta@demo.bullao.test", "Consultor de finanzas"],
];

export async function setup(directory = fileURLToPath(new URL("../", import.meta.url))) {
  const file = resolve(directory, ".env.local");
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    text = await readFile(resolve(directory, ".env.example"), "utf8");
    await writeFile(file, text, { mode: 0o600, flag: "wx" });
  }
  const env = parseEnv(text);
  const legacyFile = resolve(directory, "data/demo-accounts.local.json");
  let legacy = [];
  try {
    legacy = JSON.parse(await readFile(legacyFile, "utf8"));
    if (!Array.isArray(legacy)) throw new Error("Formato de cuentas demo no válido.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const values = { BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET || randomBytes(32).toString("base64url") };
  for (const [id, email] of personas) {
    const previous = legacy.find((account) => account.email === email);
    values[`DEMO_${id}_EMAIL`] = env[`DEMO_${id}_EMAIL`] || email;
    values[`DEMO_${id}_PASSWORD`] = env[`DEMO_${id}_PASSWORD`] || previous?.password || randomBytes(24).toString("base64url");
  }
  for (const [key, value] of Object.entries(values)) {
    const assignment = `${key}=${JSON.stringify(value)}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    text = pattern.test(text) ? text.replace(pattern, () => assignment) : `${text.trimEnd()}\n${assignment}\n`;
  }
  await chmod(file, 0o600);
  await writeFile(file, text, { mode: 0o600 });
  // Delete the old copy only after every account is preserved in the new file.
  const saved = parseEnv(await readFile(file, "utf8"));
  if (legacy.length && legacy.every((account) => personas.some(([id]) => saved[`DEMO_${id}_EMAIL`] === account.email && saved[`DEMO_${id}_PASSWORD`] === account.password))) {
    await unlink(legacyFile);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await setup();
  console.log("Configuración preparada en .env.local (modo 0600). No se muestran secretos ni se cambian cuentas existentes.");
}
