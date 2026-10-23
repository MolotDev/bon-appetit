import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dictionary } from "@/constants/dictionary";
import { useAuthStore } from "@/stores/authStore";

const MIN_PASSWORD_LENGTH = 8;

export function ForceChangePasswordView() {
  const profile = useAuthStore((state) => state.profile);
  const changePassword = useAuthStore((state) => state.changePassword);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!profile) {
    return <Navigate to="/login" replace />;
  }
  if (!profile.must_change_password) {
    return <Navigate to={profile.role === "ADMIN" ? "/admin/menu" : "/"} replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(dictionary.passwordChange.tooShort);
      return;
    }
    if (password !== confirm) {
      toast.error(dictionary.passwordChange.mismatch);
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(password);
      toast.success(dictionary.passwordChange.success);
    } catch (error) {
      const message = error instanceof Error ? error.message : dictionary.states.errorGeneric;
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{dictionary.passwordChange.title}</CardTitle>
          <CardDescription>{dictionary.passwordChange.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-password">{dictionary.passwordChange.newPassword}</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-password">{dictionary.passwordChange.confirmPassword}</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {dictionary.passwordChange.submit}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
