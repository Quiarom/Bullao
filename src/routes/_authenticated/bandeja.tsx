import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/_authenticated/bandeja")({ beforeLoad: () => { throw redirect({ to: "/cuentas", replace: true }); } });
