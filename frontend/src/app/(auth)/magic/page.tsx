"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";
import { KeyRound } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { api, getApiErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

function MagicPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const token = searchParams.get("token");

    if (startedRef.current) {
      return;
    }

    startedRef.current = true;

    if (!token) {
      setStatus("error");
      setError("Magic token is missing.");
      return;
    }

    async function verifyMagicToken() {
      setStatus("loading");

      try {
        const response = await api.get<{ accessToken: string }>(
          `/auth/magic-link/verify?token=${encodeURIComponent(token as string)}`,
        );

        setAuth(response.data.accessToken);
        router.replace("/");
      } catch (requestError) {
        setStatus("error");
        setError(getApiErrorMessage(requestError));
      }
    }

    void verifyMagicToken();
  }, [router, searchParams, setAuth]);

  return (
    <AuthShell
      title="Finishing secure sign in."
      description="Magic links are one-time and short-lived. If this one expired, request a fresh link."
      footer={
        <>
          Need a new link?{" "}
          <Link href="/login" className="font-semibold text-[var(--accent-dark)]">
            Back to login
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)]/10 text-[var(--accent-dark)]">
          <KeyRound className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-[var(--foreground)]">
            {status === "error" ? "Magic link failed" : "Verifying magic link"}
          </h2>
          <p className="text-sm text-[var(--muted)]">
            {status === "loading"
              ? "Please wait while we exchange the token for your dashboard session."
              : "This page will redirect automatically after a successful verification."}
          </p>
        </div>

        {status === "error" ? (
          <div className="space-y-4">
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error ?? "Unable to verify magic link."}
            </p>
            <Button className="w-full" onClick={() => router.replace("/login")}>
              Go to login
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--border)] bg-white/70 px-4 py-4 text-sm text-[var(--muted)]">
            {status === "loading" ? "Verifying..." : "Preparing request..."}
          </div>
        )}
      </div>
    </AuthShell>
  );
}

export default function MagicPage() {
  return (
    <Suspense fallback={
      <AuthShell
        title="Loading..."
        description="Please wait while we prepare the verification process."
      >
        <div className="flex items-center justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--accent)] border-t-transparent"></div>
        </div>
      </AuthShell>
    }>
      <MagicPageContent />
    </Suspense>
  );
}
