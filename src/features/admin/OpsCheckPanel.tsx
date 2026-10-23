import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dictionary } from "@/constants/dictionary";
import {
  checkAdminMenuDeadline,
  checkUserOrderDeadline,
  invokeSendPush,
} from "@/services/api";
import { getNotificationPermission } from "@/services/push";
import { useAuthStore } from "@/stores/authStore";
import {
  defaultOrderTargetDate,
  formatDateUk,
  formatKyivNow,
  isAdminMenuDeadlineOpen,
  isUserOrderDeadlineOpen,
} from "@/utils/date";

export function OpsCheckPanel() {
  const profile = useAuthStore((state) => state.profile);
  const tomorrow = defaultOrderTargetDate();
  const [serverMenuOpen, setServerMenuOpen] = useState<boolean | null>(null);
  const [serverOrderOpen, setServerOrderOpen] = useState<boolean | null>(null);
  const [sending, setSending] = useState(false);

  const clientMenuOpen = isAdminMenuDeadlineOpen(tomorrow);
  const clientOrderOpen = isUserOrderDeadlineOpen(tomorrow);
  const aligned =
    serverMenuOpen === clientMenuOpen && serverOrderOpen === clientOrderOpen;

  useEffect(() => {
    void (async () => {
      try {
        const [menuOpen, orderOpen] = await Promise.all([
          checkAdminMenuDeadline(tomorrow),
          checkUserOrderDeadline(tomorrow),
        ]);
        setServerMenuOpen(menuOpen);
        setServerOrderOpen(orderOpen);
      } catch {
        setServerMenuOpen(null);
        setServerOrderOpen(null);
      }
    })();
  }, [tomorrow]);

  async function onTestPush() {
    if (!profile) {
      return;
    }
    if (getNotificationPermission() !== "granted") {
      toast.error(dictionary.push.enableFirst);
      return;
    }
    setSending(true);
    try {
      await invokeSendPush({
        title: dictionary.push.testTitle,
        body: dictionary.push.testBody,
        url: "/admin/reports",
        user_ids: [profile.id],
      });
      toast.success(dictionary.push.testSent);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.push.failed);
    } finally {
      setSending(false);
    }
  }

  function flag(value: boolean | null): string {
    if (value === null) {
      return dictionary.common.loading;
    }
    return value ? dictionary.ops.yes : dictionary.ops.no;
  }

  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle className="text-base">{dictionary.ops.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p>
          {dictionary.ops.kyivNow}: {formatKyivNow()}
        </p>
        <p>
          {dictionary.ops.tomorrow}: {formatDateUk(tomorrow)}
        </p>
        <p>
          {dictionary.ops.menuDeadline}: {dictionary.ops.client} {flag(clientMenuOpen)},{" "}
          {dictionary.ops.server} {flag(serverMenuOpen)}
        </p>
        <p>
          {dictionary.ops.orderDeadline}: {dictionary.ops.client} {flag(clientOrderOpen)},{" "}
          {dictionary.ops.server} {flag(serverOrderOpen)}
        </p>
        {serverMenuOpen !== null && serverOrderOpen !== null ? (
          <p className={aligned ? "text-emerald-700" : "text-destructive"}>
            {aligned ? dictionary.ops.aligned : dictionary.ops.mismatch}
          </p>
        ) : null}
        <Button type="button" className="h-11" disabled={sending} onClick={() => void onTestPush()}>
          {dictionary.push.sendTest}
        </Button>
      </CardContent>
    </Card>
  );
}
