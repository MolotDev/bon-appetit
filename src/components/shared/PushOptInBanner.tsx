import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { dictionary } from "@/constants/dictionary";
import {
  dismissPushBanner,
  getNotificationPermission,
  isPushBannerDismissed,
  isPushSupported,
  registerPushSubscription,
} from "@/services/push";

type PushOptInBannerProps = {
  userId: string;
};

export function PushOptInBanner({ userId }: PushOptInBannerProps) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPushSupported() || isPushBannerDismissed()) {
      setVisible(false);
      return;
    }
    setVisible(getNotificationPermission() === "default");
  }, []);

  if (!visible) {
    return null;
  }

  async function onEnable() {
    setBusy(true);
    try {
      await registerPushSubscription(userId);
      dismissPushBanner();
      setVisible(false);
      toast.success(dictionary.push.subscribed);
    } catch (error) {
      const message = error instanceof Error ? error.message : dictionary.push.failed;
      toast.error(message);
      if (getNotificationPermission() !== "default") {
        dismissPushBanner();
        setVisible(false);
      }
    } finally {
      setBusy(false);
    }
  }

  function onLater() {
    dismissPushBanner();
    setVisible(false);
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-accent px-3 py-3">
      <p className="flex-1 text-sm leading-snug text-accent-foreground">{dictionary.push.banner}</p>
      <div className="flex shrink-0 flex-col gap-1">
        <Button type="button" size="sm" disabled={busy} onClick={() => void onEnable()}>
          {dictionary.push.enable}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={onLater}>
          {dictionary.push.later}
        </Button>
      </div>
    </div>
  );
}
