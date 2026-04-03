import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1 },
    mutations: { retry: 0 },
  },
});

// ---------------------------------------------------------------------------
// Token refresh helpers
// ---------------------------------------------------------------------------

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const EXPIRES_AT_KEY = "accessTokenExpiresAt";

/** Возвращает true, если access token истёк или истекает в ближайшую минуту. */
function isAccessTokenExpired(): boolean {
  const expiresAt = Number(localStorage.getItem(EXPIRES_AT_KEY) ?? 0);
  return Date.now() > expiresAt - 60_000; // за 1 минуту до истечения
}

/** Обменивает refresh token на новую пару токенов и сохраняет их. */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  try {
    const res = await fetch("/api/trpc/auth.refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ "0": { refreshToken } }),
    });

    if (!res.ok) {
      clearAuthStorage();
      window.location.href = "/";
      return null;
    }

    const json = await res.json();
    const data = json[0]?.result?.data;
    if (!data?.accessToken) {
      clearAuthStorage();
      window.location.href = "/";
      return null;
    }

    localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    localStorage.setItem(EXPIRES_AT_KEY, String(data.accessTokenExpiresAt));
    // Обратная совместимость
    localStorage.setItem("token", data.accessToken);
    return data.accessToken;
  } catch {
    clearAuthStorage();
    window.location.href = "/";
    return null;
  }
}

function clearAuthStorage() {
  ["accessToken", "refreshToken", "accessTokenExpiresAt", "user", "token"].forEach(k =>
    localStorage.removeItem(k),
  );
}

// ---------------------------------------------------------------------------
// Перенаправление на логин при ошибках авторизации
// ---------------------------------------------------------------------------

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized =
    error.message?.includes("Invalid") ||
    error.message?.includes("UNAUTHORIZED") ||
    error.data?.code === "UNAUTHORIZED";

  if (!isUnauthorized) return;
  clearAuthStorage();
  window.location.href = "/";
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    redirectToLoginIfUnauthorized(event.query.state.error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    redirectToLoginIfUnauthorized(event.mutation.state.error);
  }
});

// ---------------------------------------------------------------------------
// tRPC клиент с авто-рефрешем
// ---------------------------------------------------------------------------

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async fetch(input, init) {
        // Проверяем, не истёк ли access token перед запросом
        let accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
        if (accessToken && isAccessTokenExpired()) {
          accessToken = await refreshAccessToken();
        }

        const headers = new Headers(init?.headers ?? {});
        if (accessToken) {
          headers.set("Authorization", `Bearer ${accessToken}`);
        }

        return globalThis.fetch(input, { ...(init ?? {}), credentials: "include", headers });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>,
);
