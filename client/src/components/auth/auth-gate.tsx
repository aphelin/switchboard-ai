"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { onUnauthorized } from "@/lib/auth-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MIN_PASSWORD_LENGTH = 8;

type AuthTab = "sign-in" | "sign-up";

/**
 * Renders the app only for signed-in users. Without a session it shows a
 * sign-in / create-account modal that cannot be dismissed, and nothing behind
 * it is mounted, so no authenticated API call or SSE connection is attempted.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { data: session, isPending, refetch } = authClient.useSession();

  // Any 401 from the API means the session may be gone: re-check it.
  useEffect(() => onUnauthorized(() => void refetch()), [refetch]);

  if (isPending && !session) {
    return (
      <div className="flex min-h-screen items-center justify-center" data-testid="auth-loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen" data-testid="auth-signed-out">
        <AuthDialog />
      </div>
    );
  }

  return <>{children}</>;
}

function AuthDialog() {
  const [tab, setTab] = useState<AuthTab>("sign-in");

  return (
    <Dialog
      open
      // Signed-out users must authenticate: ignore Escape and outside clicks.
      onOpenChange={() => undefined}
      disablePointerDismissal
    >
      <DialogContent showCloseButton={false} className="sm:max-w-sm" data-testid="auth-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Mini AI Toolkit
          </DialogTitle>
          <DialogDescription>
            {tab === "sign-in"
              ? "Sign in to continue."
              : "Create an account to get started."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as AuthTab)}>
          <TabsList className="w-full">
            <TabsTrigger value="sign-in" data-testid="auth-tab-sign-in">
              Sign in
            </TabsTrigger>
            <TabsTrigger value="sign-up" data-testid="auth-tab-sign-up">
              Create account
            </TabsTrigger>
          </TabsList>
          <TabsContent value="sign-in" className="pt-2">
            <SignInForm />
          </TabsContent>
          <TabsContent value="sign-up" className="pt-2">
            <SignUpForm />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { error: authError } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (authError) setError(authErrorMessage(authError, "Sign in failed"));
    } catch {
      setError("Could not reach the server. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit} data-testid="sign-in-form">
      <Field label="Email" htmlFor="sign-in-email">
        <Input
          id="sign-in-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Password" htmlFor="sign-in-password">
        <Input
          id="sign-in-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <FormError message={error} />
      <Button type="submit" className="w-full" disabled={submitting} data-testid="sign-in-submit">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}

function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { error: authError } = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      if (authError) setError(authErrorMessage(authError, "Could not create the account"));
    } catch {
      setError("Could not reach the server. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit} data-testid="sign-up-form">
      <Field label="Name" htmlFor="sign-up-name">
        <Input
          id="sign-up-name"
          autoComplete="name"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Email" htmlFor="sign-up-email">
        <Input
          id="sign-up-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field
        label="Password"
        htmlFor="sign-up-password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
      >
        <Input
          id="sign-up-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <FormError message={error} />
      <Button type="submit" className="w-full" disabled={submitting} data-testid="sign-up-submit">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Create account
      </Button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive"
      data-testid="auth-error"
    >
      {message}
    </p>
  );
}

function authErrorMessage(
  error: { message?: string; statusText?: string; status?: number },
  fallback: string,
): string {
  if (error.status === 429) return "Too many attempts. Wait a minute and try again.";
  return error.message || error.statusText || fallback;
}
