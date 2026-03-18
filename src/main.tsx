import { createRoot } from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";
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
    ...(organization ? { organization } : {}),
  },
};

createRoot(document.getElementById("root")!).render(
  <Auth0Provider {...providerConfig}>
    <App />
  </Auth0Provider>,
);
