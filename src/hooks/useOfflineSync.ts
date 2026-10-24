import { useEffect } from "react";
import { processOrderSyncQueue } from "@/services/orderSync";

export function useOfflineSync(): void {
  useEffect(() => {
    function handleOnline() {
      void processOrderSyncQueue();
    }

    window.addEventListener("online", handleOnline);
    if (navigator.onLine) {
      void processOrderSyncQueue();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, []);
}
