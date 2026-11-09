import type { Customer, Settings, Trip } from "./types";
import { billNo, csvBlob, fmtDate, num, sums, today, tripTotal } from "./utils";

/** Builds and downloads the bill as a PDF (A4 landscape). */
export async function downloadBillPdf(list: Trip[], settings: Settings, period: string, customer: Customer | null) {
  // Loaded only when needed, so the app opens faster.
  const { jsPDF } = await import("jspdf");
  const { autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const s = sums(list);
  const W = 297;
  const name = settings.businessName || "Transport Service";

  // Header band
  doc.setFillColor(30, 64, 120);
  doc.rect(0, 0, W, 24, "F");
  doc.setTextColor(255);
  doc.setFontSize(17);
  doc.text(name, 14, 11);
  doc.setFontSize(9.5);
  doc.text([settings.phone ? `Phone: ${settings.phone}` : "", settings.address, "Transport Bill"].filter(Boolean).join("   |   "), 14, 18);
  doc.setFontSize(10);
  doc.text(`Bill No: ${billNo()}`, W - 14, 11, { align: "right" });
  doc.text(`Bill Date: ${fmtDate(today())}`, W - 14, 18, { align: "right" });

  doc.setTextColor(28, 36, 51);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Bill To: ${customer?.name ?? ""}`, 14, 31);
  doc.setFont("helvetica", "normal");
  doc.text(`Period: ${period}`, W - 14, 31, { align: "right" });
  const cLine = [customer?.address, customer?.phone ? `Ph: ${customer.phone}` : ""].filter(Boolean).join("   ");
  if (cLine) { doc.setFontSize(9); doc.text(cLine, 14, 35.5); doc.setFontSize(11); }

  const body = list.map((t, i) => [
    i + 1, fmtDate(t.date), t.slipNo, t.vehicleNo, t.vehicleType, `${t.from}  >  ${t.to}`, t.route, t.qty,
    num(t.rent), t.loading ? num(t.loadAmt) : "-", t.detention ? num(t.detentionAmt) : "-",
    t.extra ? num(t.extra) : "-", num(tripTotal(t)),
  ]);

  autoTable(doc, {
    startY: 39,
    head: [["#", "Date", "Slip No", "Vehicle", "Type", "From > To", "Route", "Qty", "Fare", "Load/Unload", "Detention", "Extra", "Total"]],
    body,
    foot: [["", "", "", "", "", "", "", "Total", num(s.rent), num(s.load), num(s.detention), num(s.extra), num(s.total)]],
    showFoot: "lastPage",
    styles: { fontSize: 7.5, cellPadding: 1.6 },
    headStyles: { fillColor: [30, 64, 120] },
    footStyles: { fillColor: [223, 233, 248], textColor: [28, 36, 51], fontStyle: "bold" },
    columnStyles: {
      8: { halign: "right" }, 9: { halign: "right" }, 10: { halign: "right" }, 11: { halign: "right" },
      12: { halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [247, 249, 252] },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`Page ${doc.getNumberOfPages()}`, W - 14, 205, { align: "right" });
    },
  });

  let y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40) + 8;
  if (y > 158) { doc.addPage(); y = 20; }

  doc.setTextColor(28, 36, 51);
  doc.setFontSize(10.5);
  const lines: [string, string][] = [
    ["Total Trips", String(s.n)],
    ["Fare Total", `Rs ${num(s.rent)}`],
    [`Loading/Unloading (${s.loadN} trips)`, `Rs ${num(s.load)}`],
    [`Detention (${s.detentionN} trips)`, `Rs ${num(s.detention)}`],
    ["Extra Charges", `Rs ${num(s.extra)}`],
  ];
  lines.forEach(([a, b], i) => {
    doc.text(a, W - 110, y + i * 6.5);
    doc.text(b, W - 14, y + i * 6.5, { align: "right" });
  });
  y += lines.length * 6.5 + 2;
  doc.setDrawColor(30, 64, 120);
  doc.line(W - 110, y - 3, W - 14, y - 3);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("GRAND TOTAL", W - 110, y + 4);
  doc.text(`Rs ${num(s.total)}`, W - 14, y + 4, { align: "right" });
  doc.setFont("helvetica", "normal");

  doc.setFontSize(9);
  doc.setTextColor(102);
  doc.text("Note: Rates include fuel (diesel) and both-way travel.", 14, y + 4);
  doc.setTextColor(28, 36, 51);
  doc.line(14, y + 22, 74, y + 22);
  doc.line(W - 74, y + 22, W - 14, y + 22);
  doc.text("Prepared By", 14, y + 27);
  doc.text("Received / Approved By", W - 74, y + 27);

  const company = (customer?.name || "Bill").split(" ")[0].replace(/[^\w-]/g, "");
  doc.save(`Bill_${company}_${period.replace(/\//g, "-").replace(/ /g, "")}.pdf`);
}

/** Builds a CSV file of trips that opens in Excel. */
export function buildCsv(list: Trip[], customerName: (id: string) => string): Blob {
  const s = sums(list);
  return csvBlob([
    ["Date", "Customer", "Slip No", "Bilty No", "Vehicle No", "Vehicle Type", "Driver", "From", "To", "Route", "Quantity",
      "Fare", "Loading/Unloading", "Detention", "Extra", "Bill Total", "Vehicle Owner", "Owner Payment", "Owner Paid?", "Notes"],
    ...list.map((t) => [
      fmtDate(t.date), customerName(t.customerId), t.slipNo, t.biltyNo, t.vehicleNo, t.vehicleType, t.driverName, t.from, t.to,
      t.route, t.qty, t.rent, t.loading ? t.loadAmt : 0, t.detention ? t.detentionAmt : 0, t.extra || 0, tripTotal(t),
      t.hired ? t.hiredParty : "", t.hired ? t.hiredCost : 0, t.hired ? (t.hiredPaid ? "Paid" : "Not paid") : "", t.notes,
    ]),
    ["", "", "", "", "", "", "", "", "", "", "TOTAL", s.rent, s.load, s.detention, s.extra, s.total, "", "", "", ""],
  ]);
}
