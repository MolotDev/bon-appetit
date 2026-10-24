import type { ReactNode } from "react";
import { dictionary } from "@/constants/dictionary";
import { Button } from "@/components/ui/button";

type ScreenStateProps = {
  status: "loading" | "empty" | "error" | "success";
  emptyMessage?: string;
  errorMessage?: string;
  onRetry?: () => void;
  children: ReactNode;
};

export function ScreenState({
  status,
  emptyMessage = dictionary.states.emptyGeneric,
  errorMessage = dictionary.states.errorGeneric,
  onRetry,
  children,
}: ScreenStateProps) {
  if (status === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p>{dictionary.common.loading}</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-medium">{dictionary.states.errorTitle}</p>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
        {onRetry ? (
          <Button type="button" variant="outline" onClick={onRetry}>
            {dictionary.common.retry}
          </Button>
        ) : null}
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6 text-center text-muted-foreground">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
}
