import type { ReactNode } from "react";

type DashboardPageProps = {
  title: string;
  toolbar: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

export function DashboardPage({ title, toolbar, children, footer }: DashboardPageProps) {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight print:hidden">{title}</h1>
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto border-b p-3 print:hidden">
          {toolbar}
        </div>
        {children}
      </div>
      {footer}
    </section>
  );
}
