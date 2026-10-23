import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DashboardPage } from "@/components/shared/DashboardPage";
import { ScreenState } from "@/components/ScreenState";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dictionary } from "@/constants/dictionary";
import { filterControlClassName, selectClassName } from "@/constants/form";
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

type ModalMode = "closed" | "create" | "edit" | "password";

const emptyForm = {
  username: "",
  fullName: "",
  role: "USER" as UserRole,
  locationId: "",
};

export function UsersPanelView() {
  const currentUserId = useAuthStore((state) => state.profile?.id);
  const [status, setStatus] = useState<"loading" | "empty" | "error" | "success">("loading");
  const [errorMessage, setErrorMessage] = useState<string>(dictionary.states.errorGeneric);
  const [users, setUsers] = useState<Profile[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | UserRole>("ALL");
  const [form, setForm] = useState(emptyForm);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [modal, setModal] = useState<ModalMode>("closed");
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [saving, setSaving] = useState(false);
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
    return users.filter((user) => {
      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
      const matchesQuery =
        needle.length === 0 ||
        user.full_name.toLowerCase().includes(needle) ||
        user.username.toLowerCase().includes(needle);
      return matchesRole && matchesQuery;
    });
  }, [query, roleFilter, users]);

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

  function openCreate() {
    setForm(emptyForm);
    setEditingUser(null);
    setRevealedPassword(null);
    setPasswordUserId(null);
    setPasswordCopied(false);
    setModal("create");
  }

  function openEdit(user: Profile) {
    setEditingUser(user);
    setForm({
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      locationId: user.default_location_id ?? "",
    });
    setRevealedPassword(null);
    setPasswordCopied(false);
    setModal("edit");
  }

  function openPassword(userId: string, password: string) {
    setPasswordUserId(userId);
    setRevealedPassword(password);
    setPasswordCopied(false);
    setModal("password");
  }

  function closeModal() {
    if (modal === "password" && !passwordCopied) {
      return;
    }
    setModal("closed");
    setEditingUser(null);
    setRevealedPassword(null);
    setPasswordUserId(null);
    setPasswordCopied(false);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextUsername = form.username.trim().toLowerCase();
    const nextFullName = form.fullName.trim();
    if (modal === "create" && !/^[a-z0-9._-]{3,32}$/.test(nextUsername)) {
      toast.error(dictionary.users.usernameInvalid);
      return;
    }
    if (nextFullName.length < 2) {
      toast.error(dictionary.users.fullNameInvalid);
      return;
    }
    setSaving(true);
    try {
      if (modal === "edit" && editingUser) {
        const updated = await updateProfile(editingUser.id, {
          full_name: nextFullName,
          role: form.role,
          default_location_id: form.locationId.length > 0 ? form.locationId : null,
        });
        setUsers((current) => current.map((row) => (row.id === updated.id ? updated : row)));
        toast.success(dictionary.users.updated);
        setModal("closed");
        return;
      }

      const password = generateTempPassword();
      const result = await invokeAdminUsers({
        action: "create",
        username: nextUsername,
        full_name: nextFullName,
        role: form.role,
        default_location_id: form.locationId.length > 0 ? form.locationId : null,
        password,
      });
      toast.success(dictionary.users.created);
      await load();
      setPasswordUserId(result.user_id);
      setRevealedPassword(null);
      setPasswordCopied(false);
      setModal("password");
    } catch (error) {
      toast.error(mapAdminError(error instanceof Error ? error.message : ""));
    } finally {
      setSaving(false);
    }
  }

  async function onGeneratePassword() {
    if (!passwordUserId) {
      return;
    }
    setSaving(true);
    try {
      const nextPassword = generateTempPassword();
      const result = await invokeAdminUsers({
        action: "reset_password",
        user_id: passwordUserId,
        password: nextPassword,
      });
      setRevealedPassword(result.password ?? nextPassword);
      setPasswordCopied(false);
      toast.success(dictionary.users.passwordReset);
      await load();
    } catch (error) {
      toast.error(mapAdminError(error instanceof Error ? error.message : ""));
    } finally {
      setSaving(false);
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
      toast.success(dictionary.users.passwordReset);
      await load();
      openPassword(user.id, result.password ?? nextPassword);
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
      setPasswordCopied(true);
      toast.success(dictionary.common.copied);
    } catch {
      toast.error(dictionary.states.errorGeneric);
    }
  }

  const dialogTitle =
    modal === "edit"
      ? dictionary.users.editTitle
      : modal === "password"
        ? dictionary.users.tempPassword
        : dictionary.users.createTitle;

  return (
    <>
      <DashboardPage
        title={dictionary.screens.adminUsers}
        toolbar={
          <>
            <Input
              id="user-filter"
              className="h-10 w-56 shrink-0"
              value={query}
              placeholder={dictionary.users.filter}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className={cn(filterControlClassName, "w-40")}
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as "ALL" | UserRole)}
              aria-label={dictionary.users.role}
            >
              <option value="ALL">{dictionary.users.allRoles}</option>
              <option value="USER">{dictionary.role.USER}</option>
              <option value="ADMIN">{dictionary.role.ADMIN}</option>
            </select>
            <Button type="button" className="ml-auto h-10 shrink-0" onClick={openCreate}>
              {dictionary.common.create}
            </Button>
          </>
        }
      >
        <ScreenState
          status={listStatus}
          emptyMessage={emptyMessage}
          errorMessage={errorMessage}
          onRetry={() => void load()}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
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
                          <p className="text-xs text-muted-foreground">
                            {dictionary.users.mustChangePassword}
                          </p>
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
                            onClick={() => openEdit(user)}
                          >
                            {dictionary.common.edit}
                          </Button>
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
        </ScreenState>
      </DashboardPage>

      <Dialog
        open={modal !== "closed"}
        title={dialogTitle}
        closeDisabled={modal === "password" && !passwordCopied}
        onClose={closeModal}
      >
        {modal === "password" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">{dictionary.users.copyThenClose}</p>
            {revealedPassword ? (
              <p className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm">{revealedPassword}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{dictionary.users.generateAfterCreate}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                className="h-10"
                disabled={saving || !passwordUserId}
                onClick={() => void onGeneratePassword()}
              >
                {dictionary.users.generatePassword}
              </Button>
              <Button
                type="button"
                className="h-10"
                disabled={!revealedPassword}
                onClick={() => void onCopyPassword()}
              >
                {dictionary.users.copyPassword}
              </Button>
            </div>
          </div>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-username">{dictionary.users.username}</Label>
              <Input
                id="user-username"
                autoComplete="off"
                disabled={modal === "edit"}
                value={form.username}
                onChange={(event) =>
                  setForm((current) => ({ ...current, username: event.target.value.toLowerCase() }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-full-name">{dictionary.users.fullName}</Label>
              <Input
                id="user-full-name"
                autoComplete="off"
                value={form.fullName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, fullName: event.target.value }))
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-role">{dictionary.users.role}</Label>
              <select
                id="user-role"
                className={selectClassName}
                value={form.role}
                onChange={(event) =>
                  setForm((current) => ({ ...current, role: event.target.value as UserRole }))
                }
              >
                <option value="USER">{dictionary.role.USER}</option>
                <option value="ADMIN">{dictionary.role.ADMIN}</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-location">{dictionary.users.location}</Label>
              <select
                id="user-location"
                className={selectClassName}
                value={form.locationId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, locationId: event.target.value }))
                }
              >
                <option value="">{dictionary.users.locationNone}</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
            {modal === "create" ? (
              <p className="text-sm text-muted-foreground">{dictionary.users.generateAfterCreate}</p>
            ) : null}
            <Button type="submit" className="h-10" disabled={saving}>
              {modal === "edit" ? dictionary.common.save : dictionary.common.create}
            </Button>
          </form>
        )}
      </Dialog>
    </>
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
