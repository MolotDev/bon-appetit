type DeadlineBannerProps = {
  message: string;
};

export function DeadlineBanner({ message }: DeadlineBannerProps) {
  return (
    <div
      role="status"
      className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive"
    >
      {message}
    </div>
  );
}
