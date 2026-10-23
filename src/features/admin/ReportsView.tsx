import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ScreenState } from "@/components/ScreenState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dictionary } from "@/constants/dictionary";
import { getDeliveryReport, getKitchenReport } from "@/services/api";
import type { DeliveryReportRow, KitchenReportRow, MealType } from "@/types";
import { cn } from "@/utils/cn";
import { defaultOrderTargetDate, formatDateUk } from "@/utils/date";
import { buildMessengerSummary, exportReportPdf } from "@/utils/reportExport";

type ReportTab = "kitchen" | "supply";

export function ReportsView() {
  const [date, setDate] = useState(defaultOrderTargetDate);
  const [tab, setTab] = useState<ReportTab>("kitchen");
  const [status, setStatus] = useState<"loading" | "empty" | "error" | "success">("loading");
  const [errorMessage, setErrorMessage] = useState<string>(dictionary.states.errorGeneric);
  const [kitchen, setKitchen] = useState<KitchenReportRow[]>([]);
  const [delivery, setDelivery] = useState<DeliveryReportRow[]>([]);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  async function loadReports(targetDate: string) {
    setStatus("loading");
    try {
      const [kitchenRows, deliveryRows] = await Promise.all([
        getKitchenReport(targetDate),
        getDeliveryReport(targetDate),
      ]);
      setKitchen(kitchenRows);
      setDelivery(deliveryRows);
      setStatus("success");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : dictionary.states.errorGeneric);
      setStatus("error");
    }
  }

  useEffect(() => {
    void loadReports(date);
  }, [date]);

  const hasKitchen = kitchen.length > 0;
  const hasSupply = delivery.some(
    (row) =>
      row.breakfast_count +
        row.lunch_first_count +
        row.lunch_second_count +
        row.dinner_count +
        row.kits_count >
      0,
  );

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(buildMessengerSummary(date, kitchen, delivery));
      toast.success(dictionary.reports.copied);
    } catch {
      toast.error(dictionary.states.errorGeneric);
    }
  }

  async function onPdf() {
    const node = exportRef.current;
    if (!node) {
      return;
    }
    setExporting(true);
    try {
      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), 50);
      });
      await exportReportPdf(node, `bon-appetit-${date}.pdf`);
    } catch {
      toast.error(dictionary.reports.pdfFailed);
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold print:hidden">{dictionary.screens.adminReports}</h1>
      <div className="flex flex-col gap-2 print:hidden">
        <Label htmlFor="report-date">{dictionary.common.date}</Label>
        <Input
          id="report-date"
          type="date"
          className="h-11"
          value={date}
          onChange={(event) => setDate(event.target.value || defaultOrderTargetDate())}
        />
      </div>
      <div className="flex flex-col gap-2 print:hidden sm:flex-row">
        <Button type="button" variant="outline" className="h-11" onClick={() => window.print()}>
          {dictionary.reports.print}
        </Button>
        <Button type="button" variant="outline" className="h-11" disabled={exporting} onClick={() => void onPdf()}>
          {dictionary.reports.exportPdf}
        </Button>
        <Button type="button" className="h-11" onClick={() => void onCopy()}>
          {dictionary.reports.copySummary}
        </Button>
      </div>
      <div className="flex gap-2 print:hidden">
        <Button
          type="button"
          variant={tab === "kitchen" ? "default" : "secondary"}
          className="h-11 flex-1"
          onClick={() => setTab("kitchen")}
        >
          {dictionary.reports.kitchenTitle}
        </Button>
        <Button
          type="button"
          variant={tab === "supply" ? "default" : "secondary"}
          className="h-11 flex-1"
          onClick={() => setTab("supply")}
        >
          {dictionary.reports.deliveryTitle}
        </Button>
      </div>

      <ScreenState
        status={status}
        errorMessage={errorMessage}
        onRetry={() => void loadReports(date)}
      >
        <div
          ref={exportRef}
          className={cn("flex flex-col gap-4 bg-background p-1", exporting && "p-4")}
        >
          <div className="hidden print:block">
            <h1 className="text-xl font-semibold">
              {dictionary.appName}: {dictionary.reports.heading} {formatDateUk(date)}
            </h1>
          </div>
          {exporting ? (
            <h1 className="text-xl font-semibold">
              {dictionary.appName}: {dictionary.reports.heading} {formatDateUk(date)}
            </h1>
          ) : null}

          <div className={cn(tab === "kitchen" || exporting ? "block" : "hidden", "print:block")}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{dictionary.reports.kitchenTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                {!hasKitchen ? (
                  <p className="text-sm text-muted-foreground">{dictionary.reports.kitchenEmpty}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="py-2 pr-3 font-medium">{dictionary.reports.category}</th>
                          <th className="py-2 pr-3 font-medium">{dictionary.reports.dish}</th>
                          <th className="py-2 font-medium">{dictionary.reports.portions}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kitchen.map((row) => (
                          <tr key={`${row.dish_title}-${row.meal_type}`} className="border-b last:border-0">
                            <td className="py-2 pr-3">{dictionary.mealType[row.meal_type as MealType]}</td>
                            <td className="py-2 pr-3">{row.dish_title}</td>
                            <td className="py-2">{row.portions}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className={cn(tab === "supply" || exporting ? "block" : "hidden", "print:block")}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{dictionary.reports.deliveryTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                {!hasSupply ? (
                  <p className="text-sm text-muted-foreground">{dictionary.reports.deliveryEmpty}</p>
                ) : (
                  <>
                    <div className="mb-4 hidden overflow-x-auto md:block">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="py-2 pr-3 font-medium">{dictionary.reports.location}</th>
                            <th className="py-2 pr-3 font-medium">{dictionary.reports.breakfast}</th>
                            <th className="py-2 pr-3 font-medium">{dictionary.reports.lunchFirst}</th>
                            <th className="py-2 pr-3 font-medium">{dictionary.reports.lunchSecond}</th>
                            <th className="py-2 pr-3 font-medium">{dictionary.reports.dinner}</th>
                            <th className="py-2 font-medium">{dictionary.reports.kits}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {delivery.map((row) => (
                            <tr key={row.location_name} className="border-b last:border-0">
                              <td className="py-2 pr-3">{row.location_name}</td>
                              <td className="py-2 pr-3">{row.breakfast_count}</td>
                              <td className="py-2 pr-3">{row.lunch_first_count}</td>
                              <td className="py-2 pr-3">{row.lunch_second_count}</td>
                              <td className="py-2 pr-3">{row.dinner_count}</td>
                              <td className="py-2">{row.kits_count ?? 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex flex-col gap-3 md:hidden print:hidden">
                      {delivery.map((row) => (
                        <div key={row.location_name} className="rounded-lg border p-3 text-sm">
                          <p className="font-medium">{row.location_name}</p>
                          <p>
                            {dictionary.reports.breakfast}: {row.breakfast_count}
                          </p>
                          <p>
                            {dictionary.reports.lunchFirst}: {row.lunch_first_count}
                          </p>
                          <p>
                            {dictionary.reports.lunchSecond}: {row.lunch_second_count}
                          </p>
                          <p>
                            {dictionary.reports.dinner}: {row.dinner_count}
                          </p>
                          <p>
                            {dictionary.reports.kits}: {row.kits_count ?? 0}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </ScreenState>
    </section>
  );
}
