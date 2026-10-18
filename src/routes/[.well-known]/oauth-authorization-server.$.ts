import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/server/auth.server";

export const Route = createFileRoute("/.well-known/oauth-authorization-server/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      HEAD: ({ request }) => auth.handler(request),
    },
  },
});
