import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/cuentas_/$id")({ beforeLoad: ({ params }) => { throw redirect({ to: "/cuentas", search: { cuenta: params.id }, replace: true }); } });
