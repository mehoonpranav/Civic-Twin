import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginDepartment } from "@/lib/department.functions";
import { getDepartmentToken, setDepartmentToken } from "@/lib/department";
import { DepartmentDesk } from "@/routes/department.desk";

export const Route = createFileRoute("/department")({
  head: () => ({
    meta: [{ title: "Department login — CivicTwin" }],
  }),
  component: DepartmentLogin,
});

function DepartmentLogin() {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (getDepartmentToken()) setAuthed(true);
  }, []);

  const submit = async () => {
    setBusy(true);
    try {
      const { token } = await loginDepartment({ data: { id, password } });
      setDepartmentToken(token);
      toast.success("Department access granted.");
      setAuthed(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  if (authed) return <DepartmentDesk />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 pt-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Shield className="size-6" />
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight">Department login</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review, approve, and manage civic reports before they go public.
          </p>
        </div>
        <div className="shadow-card space-y-3 rounded-2xl border border-border bg-card p-6">
          <Input placeholder="Department ID" value={id} onChange={(e) => setId(e.target.value)} />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
          />
          <Button className="w-full rounded-full" disabled={busy || !id || !password} onClick={() => void submit()}>
            Sign in
          </Button>
        </div>
      </div>
    </main>
  );
}
