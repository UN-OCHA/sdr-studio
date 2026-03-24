import { Auth0Provider } from "@auth0/auth0-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
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
});

createRoot(document.getElementById("root")!).render(
  <Auth0Provider {...providerConfig}>
    <QueryClientProvider client={queryClient}>
      <App />
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
    </QueryClientProvider>
  </Auth0Provider>,
);
