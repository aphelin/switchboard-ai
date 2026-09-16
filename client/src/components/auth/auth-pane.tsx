"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spin } from "@/components/tui/spin";
import { Orb } from "@/components/tui/logo";
import { cn } from "@/lib/utils";

const MIN_PASSWORD_LENGTH = 8;

type AuthTab = "sign-in" | "sign-up";

/** Inline sign-in / create-account card. */
export function AuthPane({ className }: { className?: string }) {
  const [tab, setTab] = useState<AuthTab>("sign-in");

  return (
    <section className={cn("glass glass-strong p-6 sm:p-7", className)} data-testid="auth-dialog">
      <div className="mb-5 flex items-center gap-3">
        <Orb size={36} />
        <div>
          <h2 className="text-xl font-bold tracking-tight">Open a session</h2>
          <p className="text-sm text-ink-2">The free models are included. Bring your own key for the premium ones.</p>
        </div>
      </div>
      <Tabs value={tab} onValueChange={(value) => setTab(value as AuthTab)}>
        <TabsList className="w-full">
          <TabsTrigger value="sign-in" data-testid="auth-tab-sign-in">Sign in</TabsTrigger>
          <TabsTrigger value="sign-up" data-testid="auth-tab-sign-up">Create account</TabsTrigger>
        </TabsList>
        <TabsContent value="sign-in"><SignInForm /></TabsContent>
        <TabsContent value="sign-up"><SignUpForm /></TabsContent>
      </Tabs>
    </section>
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
      const { error: authError } = await authClient.signIn.email({ email: email.trim(), password });
      if (authError) setError(authErrorMessage(authError, "Sign in failed"));
    } catch {
      setError("Could not reach the server. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit} data-testid="sign-in-form">
      <Field label="Email" htmlFor="sign-in-email">
        <Input id="sign-in-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </Field>
      <Field label="Password" htmlFor="sign-in-password">
        <Input id="sign-in-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </Field>
      <FormError message={error} />
      <button type="submit" className="btn btn-primary btn-lg mt-1 w-full" disabled={submitting} data-testid="sign-in-submit">
        {submitting ? <Spin /> : null}
        Open session
        {!submitting && <ArrowRight />}
      </button>
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
      const { error: authError } = await authClient.signUp.email({ name: name.trim(), email: email.trim(), password });
      if (authError) setError(authErrorMessage(authError, "Could not create the account"));
    } catch {
      setError("Could not reach the server. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit} data-testid="sign-up-form">
      <Field label="Name" htmlFor="sign-up-name">
        <Input id="sign-up-name" autoComplete="name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
      </Field>
      <Field label="Email" htmlFor="sign-up-email">
        <Input id="sign-up-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </Field>
      <Field label="Password" htmlFor="sign-up-password" hint={`At least ${MIN_PASSWORD_LENGTH} characters`}>
        <Input id="sign-up-password" type="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </Field>
      <FormError message={error} />
      <button type="submit" className="btn btn-primary btn-lg mt-1 w-full" disabled={submitting} data-testid="sign-up-submit">
        {submitting ? <Spin /> : null}
        Create account
        {!submitting && <ArrowRight />}
      </button>
    </form>
  );
}

export function Field({ label, htmlFor, hint, children, className }: { label: ReactNode; htmlFor: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="px-1 text-sm font-semibold text-ink-2">{label}</label>
      {children}
      {hint && <p className="px-1 text-xs text-dim">{hint}</p>}
    </div>
  );
}

export function FormError({ message, testId = "auth-error" }: { message: string | null; testId?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-2xl bg-err/10 px-4 py-2.5 text-sm font-medium text-err" data-testid={testId}>
      {message}
    </p>
  );
}

function authErrorMessage(error: { message?: string; statusText?: string; status?: number }, fallback: string): string {
  if (error.status === 429) return "Too many attempts. Wait a minute and try again.";
  return error.message || error.statusText || fallback;
}
