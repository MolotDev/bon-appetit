import { dictionary } from "@/constants/dictionary";
import type { DeliveryReportRow, KitchenReportRow, MealType } from "@/types";
import { formatDateUk } from "@/utils/date";

function mealLabel(mealType: string): string {
  if (mealType in dictionary.mealType) {
    return dictionary.mealType[mealType as MealType];
  }
  return mealType;
}

export function buildMessengerSummary(
  date: string,
  kitchen: KitchenReportRow[],
  delivery: DeliveryReportRow[],
): string {
  const lines: string[] = [
    dictionary.appName,
    `${dictionary.reports.heading}: ${formatDateUk(date)}`,
    "",
    dictionary.reports.kitchenTitle,
  ];

  for (const row of kitchen) {
    lines.push(
      `${mealLabel(row.meal_type)} — ${row.dish_title}: ${dictionary.reports.orderedPortions} ${row.portions}, ${dictionary.reports.cancelledPortions} ${row.cancelled_portions}, ${dictionary.reports.toIssue} ${row.portions - row.cancelled_portions}`,
    );
  }

  lines.push("", dictionary.reports.deliveryTitle);

  if (delivery.length === 0) {
    lines.push(dictionary.reports.deliveryEmpty);
  } else {
    for (const row of delivery) {
      lines.push(
        `${row.location_name}: ${dictionary.reports.breakfast} ${row.breakfast_count}, ${dictionary.reports.lunchFirst} ${row.lunch_first_count}, ${dictionary.reports.lunchSecond} ${row.lunch_second_count}, ${dictionary.reports.dinner} ${row.dinner_count}, ${dictionary.reports.kits} ${row.kits_count ?? 0}`,
      );
    }
  }

  return lines.join("\n");
}

export async function exportReportPdf(element: HTMLElement, filename: string): Promise<void> {
  const { default: html2canvas } = await import("html2canvas");
  const { jsPDF } = await import("jspdf");

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
  });
  const image = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const pageBody = pageHeight - margin * 2;

  let heightLeft = imgHeight;
  let position = margin;
  pdf.addImage(image, "PNG", margin, position, imgWidth, imgHeight);
  heightLeft -= pageBody;

  while (heightLeft > 0) {
    position = margin - (imgHeight - heightLeft);
    pdf.addPage();
    pdf.addImage(image, "PNG", margin, position, imgWidth, imgHeight);
    heightLeft -= pageBody;
  }

  pdf.save(filename);
}
