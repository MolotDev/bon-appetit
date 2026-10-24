import { dictionary } from "@/constants/dictionary";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) {
    return null;
  }

  return (
    <div
      role="status"
      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950"
    >
      {dictionary.offline.banner}
    </div>
  );
}
