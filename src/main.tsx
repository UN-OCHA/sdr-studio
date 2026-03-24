import { Auth0Provider } from "@auth0/auth0-react";
import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { Intent } from "@blueprintjs/core";
import App from "./App.tsx";
import { getToaster } from "./hooks/useToaster";
import { ensureError } from "./utils/errorUtils";
import "./main.css";

const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
const organization = import.meta.env.VITE_AUTH0_ORGANIZATION;

const providerConfig = {
  domain,
  clientId,
  cacheLocation: "localstorage" as const,
  useRefreshTokens: true,
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: audience,
    scope: "openid profile email offline_access",
    ...(organization ? { organization } : {}),
  },
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      const meta = mutation.meta as { successMessage?: string } | undefined;
      if (meta?.successMessage) {
        getToaster().then((toaster) => {
          toaster.show({
            message: meta.successMessage!,
            intent: Intent.SUCCESS,
            icon: "tick",
          });
        });
      }
    },
    onError: (error, _variables, _context, mutation) => {
      // Skip error toast if mutation meta explicitly disables it
      const meta = mutation.meta as { hideErrorToast?: boolean } | undefined;
      if (meta?.hideErrorToast) return;

      const message = ensureError(error).message;
      getToaster().then((toaster) => {
        toaster.show({
          message: message || "An unexpected error occurred",
          intent: Intent.DANGER,
          icon: "error",
        });
      });
    },
  }),
});

createRoot(document.getElementById("root")!).render(
  <Auth0Provider {...providerConfig}>
    <QueryClientProvider client={queryClient}>
      <App />
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
    </QueryClientProvider>
  </Auth0Provider>,
);
