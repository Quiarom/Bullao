import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/server/auth.server";

export async function handleAuthRequest(request: Request) {
  const path = new URL(request.url).pathname;
  if (path.endsWith("/oauth2/authorize") || path.endsWith("/oauth2/consent")) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (session?.user.isAnonymous && path.endsWith("/oauth2/authorize") && request.method === "GET") {
      const login = new URL("/auth", request.url);
      const authorization = new URL(request.url);
      login.searchParams.set("next", authorization.pathname + authorization.search);
      return Response.redirect(login, 302);
    }
    if ((session && session.user.isAnonymous) || (!session && path.endsWith("/oauth2/consent"))) {
      return Response.json(
        { message: "Entra con tu cuenta para autorizar un asistente." },
        { status: 403 },
      );
    }
  }
  return auth.handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handleAuthRequest(request),
      POST: ({ request }) => handleAuthRequest(request),
    },
  },
});
