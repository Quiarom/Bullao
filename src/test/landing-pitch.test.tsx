import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LandingView } from "@/routes/index";
import { startDemo } from "@/lib/demo-session";

const { navigate, toastError } = vi.hoisted(() => ({ navigate: vi.fn(), toastError: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (config: { component: () => React.ReactNode }) => config, Link: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <a {...props}>{children}</a>, useNavigate: () => navigate }));
vi.mock("@/lib/demo-session", () => ({ startDemo: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

beforeEach(() => { vi.clearAllMocks(); });

describe("landing pitch", () => {
  it("starts the demo and navigates on success", async () => {
    vi.mocked(startDemo).mockResolvedValue({ ok: true } as Awaited<ReturnType<typeof startDemo>>);
    render(<LandingView />);
    fireEvent.click(screen.getByRole("button", { name: /ver demo/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/cuentas" }));
  });
  it("shows demo errors without navigating", async () => {
    vi.mocked(startDemo).mockResolvedValue({ ok: false, message: "falló" } as Awaited<ReturnType<typeof startDemo>>);
    render(<LandingView />);
    fireEvent.click(screen.getByRole("button", { name: /ver demo/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("falló"));
    expect(navigate).not.toHaveBeenCalled();
  });
  it("links to connection instructions and sets honest boundaries", () => {
    render(<LandingView />);
    expect(screen.getByRole("link", { name: /cómo conectar asistente/i })).toHaveAttribute("href", "#conectar");
    expect(screen.getByRole("heading", { name: /conecta tu asistente/i })).toBeInTheDocument();
    expect(screen.getByText(/no prometemos Hermes ya configurado ni conectores/i)).toBeInTheDocument();
    expect(screen.getByText(/no mueve dinero real/i)).toBeInTheDocument();
  });
});
