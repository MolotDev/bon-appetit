import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dictionary } from "@/constants/dictionary";
import { useAuthStore } from "@/stores/authStore";

export function LoginView() {
  const profile = useAuthStore((state) => state.profile);
  const login = useAuthStore((state) => state.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (profile) {
    if (profile.must_change_password) {
      return <Navigate to="/change-password" replace />;
    }
    return <Navigate to={profile.role === "ADMIN" ? "/admin/menu" : "/"} replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!username.trim() || !password) {
      toast.error(dictionary.login.missingFields);
      return;
    }
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (error) {
      const message = error instanceof Error ? error.message : dictionary.login.invalidCredentials;
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{dictionary.login.title}</CardTitle>
          <CardDescription>{dictionary.login.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">{dictionary.login.username}</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{dictionary.login.password}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {dictionary.login.submit}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
