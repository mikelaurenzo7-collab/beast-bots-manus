import { useEffect, useRef, useState } from "react";
import { api, setSessionToken } from "../lib/api";
import type { AuthResponse } from "../lib/types";

/**
 * Sign in with Apple — JS flow. We load Apple's SDK dynamically so the app
 * loads fast when the user already has a session. After Apple returns the
 * identity token, we exchange it at /v1/auth/apple for a bearer session.
 *
 * Apple requires matching Service ID / Return URL configured in Apple Dev
 * Portal — set VITE_APPLE_SERVICE_ID and VITE_APPLE_REDIRECT_URI at build.
 */
const APPLE_JS_URL =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: Record<string, unknown>) => void;
        signIn: () => Promise<AppleSignInResponse>;
      };
    };
  }
}

type AppleSignInResponse = {
  authorization: { code: string; id_token: string; state?: string };
  user?: { name?: { firstName?: string; lastName?: string }; email?: string };
};

export function SignInPage() {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const s = document.createElement("script");
    s.src = APPLE_JS_URL;
    s.async = true;
    s.onload = () => {
      const serviceId = import.meta.env.VITE_APPLE_SERVICE_ID;
      const redirectURI = import.meta.env.VITE_APPLE_REDIRECT_URI;
      if (!serviceId || !redirectURI) return;
      window.AppleID?.auth.init({
        clientId: serviceId,
        scope: "name email",
        redirectURI,
        usePopup: true,
      });
    };
    document.head.appendChild(s);
  }, []);

  async function handleSignIn() {
    setError(null);
    setWorking(true);
    try {
      if (!window.AppleID) throw new Error("Apple SDK not loaded");
      const resp = await window.AppleID.auth.signIn();
      const data = await api.post<AuthResponse>(
        "/v1/auth/apple",
        {
          identityToken: resp.authorization.id_token,
          email: resp.user?.email,
          fullName: resp.user?.name
            ? {
                givenName: resp.user.name.firstName,
                familyName: resp.user.name.lastName,
              }
            : undefined,
        },
        { requiresAuth: false }
      );
      setSessionToken(data.sessionToken);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100vh",
        padding: 24,
      }}
    >
      <div
        style={{
          textAlign: "center",
          maxWidth: 380,
          display: "grid",
          gap: 20,
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700 }}>Bot Boss</div>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Specialist agents that run your store, creator channel, and trading
          desk. Sign in with Apple — the only identity we support.
        </p>
        <button
          className="btn"
          onClick={handleSignIn}
          disabled={working}
          style={{ justifyContent: "center", padding: "12px 20px" }}
        >
          {working ? "Signing in…" : "Sign in with Apple"}
        </button>
        {error && <div style={{ color: "var(--bad)" }}>{error}</div>}
        <p style={{ color: "var(--muted)", fontSize: 12 }}>
          By signing in you agree to our{" "}
          <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
