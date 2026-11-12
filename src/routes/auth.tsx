import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ScanEye } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlaceSelect } from "@/components/PlaceSelect";
import { citiesForState, STATE_NAMES } from "@/lib/india-places";

const searchSchema = z.object({
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Sign in — CivicTwin" },
      { name: "description", content: "Sign in to CivicTwin to report civic problems and track resolutions." },
      { property: "og:title", content: "Sign in — CivicTwin" },
      { property: "og:description", content: "Sign in to CivicTwin to report civic problems and track resolutions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { next } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [busy, setBusy] = useState(false);

  const destination = next && next.startsWith("/") ? next : "/";

  useEffect(() => {
    if (!loading && user) navigate({ to: destination });
  }, [user, loading, navigate, destination]);

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back.");
    navigate({ to: destination });
  };

  const signUp = async () => {
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, city, state },
        // No emailRedirectTo — we do not want a confirmation / magic-link email.
      },
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }

    // Confirm-email is off → Supabase returns a session immediately.
    if (data.session) {
      setBusy(false);
      toast.success("Account created.");
      navigate({ to: destination });
      return;
    }

    // Confirm-email is still on in the dashboard. Try password sign-in anyway.
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) {
      toast.error(
        "Supabase is still requiring email confirmation. Turn OFF Confirm email under Authentication → Sign In / Providers → Email.",
      );
      return;
    }
    toast.success("Account created.");
    navigate({ to: destination });
  };

  const signInGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth?next=${encodeURIComponent(destination)}`,
      },
    });
    if (error) toast.error(error.message);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 pt-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ScanEye className="size-6" />
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight">Join CivicTwin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Report problems. Confirm others. Hold the city accountable.
          </p>
        </div>

        <div className="shadow-card rounded-2xl border border-border bg-card p-6">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-5 space-y-3">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && signIn()}
              />
              <Button className="w-full" disabled={busy || !email || !password} onClick={signIn}>
                Sign in
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="mt-5 space-y-3">
              <Input
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <PlaceSelect
                label="State"
                value={state}
                options={STATE_NAMES}
                placeholder="Search state"
                onChange={(value) => {
                  setState(value);
                  setCity("");
                }}
              />
              <PlaceSelect
                label="City"
                value={city}
                options={citiesForState(state)}
                placeholder={state ? "Search city" : "Choose a state first"}
                disabled={!state}
                onChange={setCity}
              />
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Password (min. 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                className="w-full"
                disabled={busy || !email || password.length < 6 || !fullName || !state || !city}
                onClick={signUp}
              >
                Create account
              </Button>
            </TabsContent>
          </Tabs>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={signInGoogle}>
            <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="currentColor"
                d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
              />
            </svg>
            Continue with Google
          </Button>
        </div>
      </div>
    </main>
  );
}
