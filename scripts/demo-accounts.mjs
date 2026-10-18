import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { personas } from "./setup.mjs";

export async function verifyDemoAccounts(env = process.env) {
  const url = new URL(env.BETTER_AUTH_URL || "http://localhost:8080");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || !["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Las cuentas demo solo se crean contra un servidor local.");
  }
  const accounts = personas.map(([id, , name]) => {
    const email = env[`DEMO_${id}_EMAIL`];
    const password = env[`DEMO_${id}_PASSWORD`];
    if (!email || !password || password.length < 12) throw new Error(`Configura DEMO_${id}_EMAIL y DEMO_${id}_PASSWORD en .env.local; ejecuta pnpm run setup.`);
    return { email, password, name };
  });
  for (const account of accounts) {
    async function post(path) {
      const send = () => fetch(`${url.origin}/api/auth/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: url.origin },
        body: JSON.stringify(account),
        signal: AbortSignal.timeout(15000),
      });
      let response = await send();
      for (let attempt = 0; response.status === 429 && attempt < 2; attempt++) {
        const seconds = Number(response.headers.get("x-retry-after") ?? response.headers.get("retry-after") ?? 11);
        if (!Number.isFinite(seconds) || seconds < 0 || seconds > 60) break;
        await response.body?.cancel();
        await setTimeout((seconds + 1) * 1000);
        response = await send();
      }
      return response;
    }
    let response = await post("sign-in/email");
    if (response.status === 401) {
      response = await post("sign-up/email");
      if (!response.ok) throw new Error(`No se creó ${account.email}: HTTP ${response.status}`);
      response = await post("sign-in/email");
    }
    if (!response.ok) throw new Error(`No se verificó ${account.email}: HTTP ${response.status}`);
    const session = await response.json();
    if (!session.user?.id || session.user.isAnonymous) throw new Error("La cuenta demo debe ser una cuenta real, no invitada.");
    console.log(`Cuenta verificada: ${account.email}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyDemoAccounts();
  console.log("Credenciales en .env.local. No las publiques. Las personas tienen los mismos permisos y eventos aislados.");
}
