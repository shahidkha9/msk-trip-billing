"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { getSupabase } from "@/lib/supabase";
import { PRICE_TEXT, PRODUCT_NAME, PRODUCT_TAGLINE, SUPPORT_PHONE, TRIAL_DAYS } from "@/lib/brand";
import { Button, Card, Field } from "./ui";

type Mode = "login" | "signup" | "forgot";

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <div className="text-center">
        <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-2xl bg-brand text-2xl text-white">🚚</div>
        <h1 className="text-2xl font-bold text-brand">{PRODUCT_NAME}</h1>
        <p className="text-[13px] text-muted">{PRODUCT_TAGLINE}</p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <p className="text-center text-[12px] text-muted">Help: {SUPPORT_PHONE}</p>
    </div>
  );
}

const friendly = (m: string) => {
  if (m === "Invalid login credentials") return "Wrong email or password.";
  if (/email not confirmed/i.test(m)) return "Please confirm your email first — open the link we sent you.";
  if (/already registered|already been registered/i.test(m)) return "An account with this email already exists. Please log in.";
  if (/password should be at least/i.test(m)) return "Password must be at least 6 characters.";
  if (/rate limit/i.test(m)) return "Too many tries. Please wait a few minutes and try again.";
  return m;
};

/** Login, sign-up and forgot-password screens. */
export function AuthScreens({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [business, setBusiness] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const go = (m: Mode) => { setMode(m); setError(""); setInfo(""); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(""); setInfo(""); setBusy(true);
    const sb = getSupabase();
    try {
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setError(friendly(error.message));
        else onLoggedIn();
      } else if (mode === "signup") {
        if (!business.trim()) { setError("Please enter your business name."); return; }
        if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
        if (password !== password2) { setError("The two passwords do not match."); return; }
        const { data, error } = await sb.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { business_name: business.trim(), phone: phone.trim() }, emailRedirectTo: window.location.origin },
        });
        if (error) setError(friendly(error.message));
        else if (data.session) onLoggedIn();
        else {
          setInfo("Account created! We sent a confirmation link to your email. Open it, then log in here.");
          setMode("login");
        }
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (error) setError(friendly(error.message));
        else setInfo("If this email has an account, a password reset link has been sent. Check your inbox (and spam).");
      }
    } catch {
      setError("No connection. Check your internet.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <form onSubmit={submit}>
        <Card>
          <h2 className="mb-1 text-lg font-bold">
            {mode === "login" ? "Log in" : mode === "signup" ? "Create your account" : "Reset password"}
          </h2>
          {mode === "signup" && (
            <p className="mb-3 rounded-lg bg-[#e8f6f0] px-3 py-2 text-[13px] text-ok">
              ✔ {TRIAL_DAYS} days free — no payment needed. After that {PRICE_TEXT}.
            </p>
          )}
          <div className="space-y-3">
            {mode === "signup" && (
              <>
                <Field label="Business name *">
                  <input className="field" required value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="e.g. Ali Goods Transport" />
                </Field>
                <Field label="Mobile number">
                  <input className="field" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03XX-XXXXXXX" />
                </Field>
              </>
            )}
            <Field label="Email *">
              <input type="email" required autoComplete="username" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            {mode !== "forgot" && (
              <Field label="Password *">
                <input type="password" required autoComplete={mode === "signup" ? "new-password" : "current-password"} className="field"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
            )}
            {mode === "signup" && (
              <Field label="Confirm password *">
                <input type="password" required autoComplete="new-password" className="field" value={password2} onChange={(e) => setPassword2(e.target.value)} />
              </Field>
            )}
          </div>
          <Button type="submit" className="mt-4 w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Log In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
          </Button>
          {error && <p className="mt-3 text-sm text-bad">{error}</p>}
          {info && <p className="mt-3 text-sm text-ok">{info}</p>}

          <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-center text-sm">
            {mode === "login" && (
              <>
                <p>New here? <button type="button" className="cursor-pointer font-semibold text-brand underline" onClick={() => go("signup")}>Create a free account</button></p>
                <p><button type="button" className="cursor-pointer text-muted underline" onClick={() => go("forgot")}>Forgot password?</button></p>
              </>
            )}
            {mode !== "login" && (
              <p>Already have an account? <button type="button" className="cursor-pointer font-semibold text-brand underline" onClick={() => go("login")}>Log in</button></p>
            )}
          </div>
        </Card>
      </form>
    </Shell>
  );
}

/** Shown after the user opens a password-reset link. */
export function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== password2) { setError("The two passwords do not match."); return; }
    setBusy(true);
    const { error } = await getSupabase().auth.updateUser({ password });
    setBusy(false);
    if (error) setError(friendly(error.message));
    else onDone();
  };

  return (
    <Shell>
      <form onSubmit={submit}>
        <Card>
          <h2 className="mb-3 text-lg font-bold">Set a new password</h2>
          <div className="space-y-3">
            <Field label="New password">
              <input type="password" required autoComplete="new-password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label="Confirm new password">
              <input type="password" required autoComplete="new-password" className="field" value={password2} onChange={(e) => setPassword2(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" className="mt-4 w-full" disabled={busy}>{busy ? "Saving…" : "Save Password"}</Button>
          {error && <p className="mt-3 text-sm text-bad">{error}</p>}
        </Card>
      </form>
    </Shell>
  );
}

/** Shown when the database still needs the new setup SQL. */
export function UpgradeScreen({ onRetry, onLogout }: { onRetry: () => void; onLogout: () => void }) {
  return (
    <Shell>
      <Card title="Database update needed">
        <p className="mb-2 text-sm">This version needs a one-time database update. Your data is safe.</p>
        <ol className="list-decimal space-y-1 pl-5 text-[13px]">
          <li>Open <b>supabase.com</b> → your project → <b>SQL Editor</b> → <b>New query</b>.</li>
          <li>Paste all of <code>supabase-setup.sql</code> and click <b>Run</b>.</li>
          <li>Then run <code>make-me-admin.sql</code> (with your email).</li>
          <li>Come back and click <b>Try again</b>.</li>
        </ol>
        <div className="mt-4 flex gap-2">
          <Button onClick={onRetry}>Try again</Button>
          <Button variant="secondary" onClick={onLogout}>Log out</Button>
        </div>
      </Card>
    </Shell>
  );
}
