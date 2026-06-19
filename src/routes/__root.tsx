import { useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { toast } from "sonner";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { API_BASE_URL } from "@/services/api";
import { getAccessToken } from "@/services/session";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const errorDetails = import.meta.env.DEV ? error?.message || String(error) : "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        {errorDetails ? (
          <p className="mt-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-left text-xs text-muted-foreground">
            {errorDetails}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Stratos Suite" },
      { name: "description", content: "Painel operacional integrado ao backend Django." },
      { name: "author", content: "Stratos Suite" },
      { property: "og:title", content: "Stratos Suite" },
      { property: "og:description", content: "Painel operacional integrado ao backend Django." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Stratos Suite" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function GlobalNotificationSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const base = API_BASE_URL.replace(/\/api$/, "");
    const wsBase = base.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
    const url = `${wsBase}/ws/notifications/?token=${token}`;

    let ws: WebSocket;
    let retryTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      try {
        ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data as string) as {
              event?: string;
              author_name?: string;
              content?: string;
              conversation?: string;
            };
            if (data.event === "chat.new_message") {
              // Invalidate unread count + conversation list
              void queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
              void queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
              const preview = (data.content ?? "").slice(0, 60);
              toast(`💬 ${data.author_name ?? "Mensagem"}: ${preview}`);
            }
          } catch {
            // ignore parse errors
          }
        };

        ws.onclose = () => {
          // Reconnect after 5s if closed unexpectedly
          retryTimeout = setTimeout(connect, 5000);
        };
      } catch {
        retryTimeout = setTimeout(connect, 5000);
      }
    }

    connect();

    return () => {
      clearTimeout(retryTimeout);
      ws?.close();
      wsRef.current = null;
    };
  }, [queryClient]);

  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalNotificationSocket />
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
      <Toaster richColors position="top-right" theme="dark" />
    </QueryClientProvider>
  );
}
