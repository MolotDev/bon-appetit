import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ScreenState } from "@/components/ScreenState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dictionary } from "@/constants/dictionary";
import {
  invokeAdminUsers,
  listLocations,
  listProfiles,
  updateProfile,
} from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import type { Location, Profile, UserRole } from "@/types";
import { cn } from "@/utils/cn";
import { generateTempPassword } from "@/utils/password";

const selectClassName =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50";

function mapAdminError(message: string): string {
  switch (message) {
    case "USERNAME_INVALID":
      return dictionary.users.usernameInvalid;
    case "FULL_NAME_INVALID":
      return dictionary.users.fullNameInvalid;
    case "USERNAME_EXISTS":
      return dictionary.users.usernameExists;
    case "CANNOT_DELETE_SELF":
      return dictionary.users.cannotModifySelf;
    default:
      return dictionary.states.errorGeneric;
  }
}

async function copyToClipboard(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

export function UsersPanelView() {
  const currentUserId = useAuthStore((state) => state.profile?.id);
  const [status, setStatus] = useState<"loading" | "empty" | "error" | "success">("loading");
  const [errorMessage, setErrorMessage] = useState<string>(dictionary.states.errorGeneric);
  const [users, setUsers] = useState<Profile[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [query, setQuery] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("USER");
  const [locationId, setLocationId] = useState("");
  const [tempPassword, setTempPassword] = useState(generateTempPassword);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setStatus("loading");
    try {
      const [rows, locationRows] = await Promise.all([listProfiles(), listLocations()]);
      setUsers(rows);
      setLocations(locationRows);
      setStatus(rows.length === 0 ? "empty" : "success");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : dictionary.states.errorGeneric);
      setStatus("error");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return users;
    }
    return users.filter(
      (user) =>
        user.full_name.toLowerCase().includes(needle) ||
        user.username.toLowerCase().includes(needle),
    );
  }, [query, users]);

  const listStatus = status === "success" && filtered.length === 0 ? "empty" : status;
  const emptyMessage =
    users.length > 0 && filtered.length === 0
      ? dictionary.users.emptyFiltered
      : dictionary.users.empty;

  function locationName(id: string | null): string {
    if (!id) {
      return dictionary.users.locationNone;
    }
    return locations.find((location) => location.id === id)?.name ?? dictionary.users.locationNone;
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextUsername = username.trim().toLowerCase();
    const nextFullName = fullName.trim();
    if (!/^[a-z0-9._-]{3,32}$/.test(nextUsername)) {
      toast.error(dictionary.users.usernameInvalid);
      return;
    }
    if (nextFullName.length < 2) {
      toast.error(dictionary.users.fullNameInvalid);
      return;
    }
    setCreating(true);
    try {
      const result = await invokeAdminUsers({
        action: "create",
        username: nextUsername,
        full_name: nextFullName,
        role,
        default_location_id: locationId.length > 0 ? locationId : null,
        password: tempPassword,
      });
      setRevealedPassword(result.password ?? tempPassword);
      setUsername("");
      setFullName("");
      setRole("USER");
      setLocationId("");
      setTempPassword(generateTempPassword());
      toast.success(dictionary.users.created);
      await load();
    } catch (error) {
      toast.error(mapAdminError(error instanceof Error ? error.message : ""));
    } finally {
      setCreating(false);
    }
  }

  async function onToggleBlock(user: Profile) {
    if (user.id === currentUserId) {
      toast.error(dictionary.users.cannotModifySelf);
      return;
    }
    setBusyId(user.id);
    try {
      const updated = await updateProfile(user.id, { is_blocked: !user.is_blocked });
      setUsers((current) => current.map((row) => (row.id === updated.id ? updated : row)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.states.errorGeneric);
    } finally {
      setBusyId(null);
    }
  }

  async function onResetPassword(user: Profile) {
    setBusyId(user.id);
    const nextPassword = generateTempPassword();
    try {
      const result = await invokeAdminUsers({
        action: "reset_password",
        user_id: user.id,
        password: nextPassword,
      });
      setRevealedPassword(result.password ?? nextPassword);
      toast.success(dictionary.users.passwordReset);
      await load();
    } catch (error) {
      toast.error(mapAdminError(error instanceof Error ? error.message : ""));
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(user: Profile) {
    if (user.id === currentUserId) {
      toast.error(dictionary.users.cannotModifySelf);
      return;
    }
    if (!window.confirm(dictionary.users.confirmDelete)) {
      return;
    }
    setBusyId(user.id);
    try {
      await invokeAdminUsers({ action: "delete", user_id: user.id });
      toast.success(dictionary.users.deleted);
      await load();
    } catch (error) {
      toast.error(mapAdminError(error instanceof Error ? error.message : ""));
    } finally {
      setBusyId(null);
    }
  }

  async function onCopyPassword() {
    if (!revealedPassword) {
      return;
    }
    try {
      await copyToClipboard(revealedPassword);
      toast.success(dictionary.common.copied);
    } catch {
      toast.error(dictionary.states.errorGeneric);
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">{dictionary.screens.adminUsers}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{dictionary.users.createTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onCreate}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-username">{dictionary.users.username}</Label>
              <Input
                id="new-username"
                className="h-11"
                autoComplete="off"
                value={username}
                onChange={(event) => setUsername(event.target.value.toLowerCase())}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-full-name">{dictionary.users.fullName}</Label>
              <Input
                id="new-full-name"
                className="h-11"
                autoComplete="off"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-role">{dictionary.users.role}</Label>
              <select
                id="new-role"
                className={selectClassName}
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole)}
              >
                <option value="USER">{dictionary.role.USER}</option>
                <option value="ADMIN">{dictionary.role.ADMIN}</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-location">{dictionary.users.location}</Label>
              <select
                id="new-location"
                className={selectClassName}
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
              >
                <option value="">{dictionary.users.locationNone}</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="temp-password">{dictionary.users.tempPassword}</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input id="temp-password" className="h-11 font-mono" readOnly value={tempPassword} />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 flex-1 sm:flex-none"
                    onClick={() =>
                      void copyToClipboard(tempPassword)
                        .then(() => toast.success(dictionary.common.copied))
                        .catch(() => toast.error(dictionary.states.errorGeneric))
                    }
                  >
                    {dictionary.common.copy}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-11 flex-1 sm:flex-none"
                    onClick={() => setTempPassword(generateTempPassword())}
                  >
                    {dictionary.users.generatePassword}
                  </Button>
                </div>
              </div>
            </div>
            <Button type="submit" className="h-11" disabled={creating}>
              {dictionary.common.create}
            </Button>
          </form>
        </CardContent>
      </Card>

      {revealedPassword ? (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-accent p-3 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm">
            {dictionary.users.tempPassword}: <span className="font-mono font-medium">{revealedPassword}</span>
          </p>
          <Button type="button" size="sm" className="h-11" onClick={() => void onCopyPassword()}>
            {dictionary.users.copyPassword}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="user-filter">{dictionary.users.filter}</Label>
        <Input
          id="user-filter"
          className="h-11"
          value={query}
          placeholder={dictionary.common.search}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <ScreenState
        status={listStatus}
        emptyMessage={emptyMessage}
        errorMessage={errorMessage}
        onRetry={() => void load()}
      >
        <div className="hidden overflow-x-auto rounded-lg border md:block">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-3 py-3 font-medium">{dictionary.users.fullName}</th>
                <th className="px-3 py-3 font-medium">{dictionary.users.username}</th>
                <th className="px-3 py-3 font-medium">{dictionary.users.role}</th>
                <th className="px-3 py-3 font-medium">{dictionary.users.location}</th>
                <th className="px-3 py-3 font-medium">{dictionary.users.block}</th>
                <th className="px-3 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const isSelf = user.id === currentUserId;
                const busy = busyId === user.id;
                return (
                  <tr key={user.id} className="border-t">
                    <td className="px-3 py-3">
                      <p className="font-medium">{user.full_name}</p>
                      {user.must_change_password ? (
                        <p className="text-xs text-muted-foreground">{dictionary.users.mustChangePassword}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">{user.username}</td>
                    <td className="px-3 py-3">{dictionary.role[user.role]}</td>
                    <td className="px-3 py-3">{locationName(user.default_location_id)}</td>
                    <td className="px-3 py-3">
                      <BlockSwitch
                        blocked={user.is_blocked}
                        disabled={busy || isSelf}
                        onToggle={() => void onToggleBlock(user)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => void onResetPassword(user)}
                        >
                          {dictionary.users.resetPassword}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={busy || isSelf}
                          onClick={() => void onDelete(user)}
                        >
                          {dictionary.common.delete}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 md:hidden">
          {filtered.map((user) => {
            const isSelf = user.id === currentUserId;
            const busy = busyId === user.id;
            return (
              <Card key={user.id}>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{user.full_name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 p-4 pt-2 text-sm">
                  <p>{user.username}</p>
                  <p>{dictionary.role[user.role]}</p>
                  <p className="text-muted-foreground">{locationName(user.default_location_id)}</p>
                  {user.must_change_password ? (
                    <p className="text-muted-foreground">{dictionary.users.mustChangePassword}</p>
                  ) : null}
                  <div className="flex items-center justify-between gap-3">
                    <span>{dictionary.users.block}</span>
                    <BlockSwitch
                      blocked={user.is_blocked}
                      disabled={busy || isSelf}
                      onToggle={() => void onToggleBlock(user)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    disabled={busy}
                    onClick={() => void onResetPassword(user)}
                  >
                    {dictionary.users.resetPassword}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="h-11"
                    disabled={busy || isSelf}
                    onClick={() => void onDelete(user)}
                  >
                    {dictionary.common.delete}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScreenState>
    </section>
  );
}

function BlockSwitch({
  blocked,
  disabled,
  onToggle,
}: {
  blocked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={blocked}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative h-7 w-12 rounded-full transition-colors disabled:opacity-50",
        blocked ? "bg-destructive" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
          blocked ? "left-5" : "left-0.5",
        )}
      />
      <span className="sr-only">{blocked ? dictionary.users.blocked : dictionary.users.active}</span>
    </button>
  );
}
