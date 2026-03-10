import jsPDF from "jspdf";
import {
  Patient, Visit, Doctor,
  RichiestaEsameComplementare,
  CertificatoPaziente,
} from "../types/Storage";
import { DoctorService, PreferenceService } from "./OfflineServices";
import { calcolaStimePesoFetale } from "../utils/fetalWeightUtils";
import {
  estimateCentileRank,
  formatCentileLabel,
  getCentileForWeight,
  getGrowthCategory,
  getWeightPercentiles,
  parseGestationalWeeks,
} from "../utils/fetalGrowthCentiles";

// ─── Layout ──────────────────────────────────────────────────────────────────
const ML = 15;
const MR = 195;
const PW = MR - ML;   // 180 mm
const PAGE_H = 297;
const FOOT_Y = PAGE_H - 14;
const LH = 4.8;

// ─── B&W palette ─────────────────────────────────────────────────────────────
const K0 = [0, 0, 0] as const;
const K30: [number, number, number] = [30, 30, 30];
const K80: [number, number, number] = [80, 80, 80];
const K100: [number, number, number] = [100, 100, 100];
const K140: [number, number, number] = [140, 140, 140];
const K200: [number, number, number] = [200, 200, 200];
const K235: [number, number, number] = [235, 235, 235];
const K240: [number, number, number] = [240, 240, 240];
const K245: [number, number, number] = [245, 245, 245] as const;

// ─────────────────────────────────────────────────────────────────────────────
// BIOMETRIC CENTILE DATA (Hadlock Refined)
// Ricalcolati su medie Hadlock standard con SD tipiche:
// BPD +/- 6mm, HC +/- 18mm, AC +/- 21mm, FL +/- 4.6mm
// ─────────────────────────────────────────────────────────────────────────────
interface CentilePoint { week: number; p5: number; p50: number; p95: number; }

// ─── Hadlock Biometric Centiles (Smoothed Means & Empirical SDs) ───
const BPD_CENTILES: CentilePoint[] = [
  { week: 14, p5: 22, p50: 26, p95: 30 },
  { week: 16, p5: 29, p50: 33, p95: 37 },
  { week: 18, p5: 36, p50: 41, p95: 46 },
  { week: 20, p5: 43, p50: 48, p95: 53 },
  { week: 22, p5: 50, p50: 55, p95: 60 },
  { week: 24, p5: 56, p50: 61, p95: 66 },
  { week: 26, p5: 61, p50: 67, p95: 73 },
  { week: 28, p5: 67, p50: 73, p95: 79 },
  { week: 30, p5: 72, p50: 78, p95: 84 },
  { week: 32, p5: 77, p50: 83, p95: 89 },
  { week: 34, p5: 80, p50: 87, p95: 94 },
  { week: 36, p5: 83, p50: 90, p95: 97 },
  { week: 38, p5: 86, p50: 93, p95: 100 },
  { week: 40, p5: 88, p50: 95, p95: 102 },
];
const HC_CENTILES: CentilePoint[] = [
  { week: 14, p5: 89, p50: 99, p95: 109 },
  { week: 16, p5: 113, p50: 124, p95: 135 },
  { week: 18, p5: 138, p50: 150, p95: 162 },
  { week: 20, p5: 162, p50: 175, p95: 188 },
  { week: 22, p5: 184, p50: 198, p95: 212 },
  { week: 24, p5: 207, p50: 222, p95: 237 },
  { week: 26, p5: 227, p50: 243, p95: 259 },
  { week: 28, p5: 246, p50: 263, p95: 280 },
  { week: 30, p5: 264, p50: 282, p95: 300 },
  { week: 32, p5: 279, p50: 298, p95: 317 },
  { week: 34, p5: 293, p50: 313, p95: 333 },
  { week: 36, p5: 304, p50: 325, p95: 346 },
  { week: 38, p5: 313, p50: 335, p95: 357 },
  { week: 40, p5: 320, p50: 343, p95: 366 },
];
const AC_CENTILES: CentilePoint[] = [
  { week: 14, p5: 68, p50: 78, p95: 88 },
  { week: 16, p5: 91, p50: 103, p95: 115 },
  { week: 18, p5: 114, p50: 127, p95: 140 },
  { week: 20, p5: 137, p50: 152, p95: 167 },
  { week: 22, p5: 158, p50: 175, p95: 192 },
  { week: 24, p5: 178, p50: 197, p95: 216 },
  { week: 26, p5: 199, p50: 219, p95: 239 },
  { week: 28, p5: 218, p50: 240, p95: 262 },
  { week: 30, p5: 235, p50: 259, p95: 283 },
  { week: 32, p5: 253, p50: 279, p95: 305 },
  { week: 34, p5: 270, p50: 298, p95: 326 },
  { week: 36, p5: 287, p50: 316, p95: 345 },
  { week: 38, p5: 302, p50: 333, p95: 364 },
  { week: 40, p5: 315, p50: 348, p95: 381 },
];
const FL_CENTILES: CentilePoint[] = [
  { week: 14, p5: 12, p50: 14, p95: 16 },
  { week: 16, p5: 17, p50: 20, p95: 23 },
  { week: 18, p5: 24, p50: 27, p95: 30 },
  { week: 20, p5: 30, p50: 33, p95: 36 },
  { week: 22, p5: 35, p50: 38, p95: 41 },
  { week: 24, p5: 40, p50: 44, p95: 48 },
  { week: 26, p5: 45, p50: 49, p95: 53 },
  { week: 28, p5: 50, p50: 54, p95: 58 },
  { week: 30, p5: 54, p50: 58, p95: 62 },
  { week: 32, p5: 56, p50: 61, p95: 66 },
  { week: 34, p5: 60, p50: 65, p95: 70 },
  { week: 36, p5: 63, p50: 68, p95: 73 },
  { week: 38, p5: 65, p50: 71, p95: 77 },
  { week: 40, p5: 68, p50: 74, p95: 80 },
];

// EFW centile calculation uses getCentileForWeight from fetalGrowthCentiles (Hadlock-based)
// This ensures UI and PDF use the same consistent weight centile reference.
// ─────────────────────────────────────────────────────────────────────────────
// Interpolate centile values at a given gestational age
// ─────────────────────────────────────────────────────────────────────────────
function interpolateCentile(data: CentilePoint[], gaWeeks: number): { p5: number; p50: number; p95: number } | null {
  if (!data.length) return null;
  if (gaWeeks <= data[0].week) return { p5: data[0].p5, p50: data[0].p50, p95: data[0].p95 };
  if (gaWeeks >= data[data.length - 1].week) {
    const last = data[data.length - 1];
    return { p5: last.p5, p50: last.p50, p95: last.p95 };
  }
  for (let i = 0; i < data.length - 1; i++) {
    if (gaWeeks >= data[i].week && gaWeeks <= data[i + 1].week) {
      const t = (gaWeeks - data[i].week) / (data[i + 1].week - data[i].week);
      return {
        p5: data[i].p5 + t * (data[i + 1].p5 - data[i].p5),
        p50: data[i].p50 + t * (data[i + 1].p50 - data[i].p50),
        p95: data[i].p95 + t * (data[i + 1].p95 - data[i].p95),
      };
    }
  }
  return null;
}

// Rimosso estimateCentileRank locale, importato da utils


export interface FetalGrowthPoint {
  gaWeeks: number;
  pesoGrammi: number;
  bpdMm?: number;
  hcMm?: number;
  acMm?: number;
  flMm?: number;
}

interface VisitPdfOptions {
  includeEcografiaImages?: boolean;
  includeFetalGrowthChart?: boolean;
  fetalGrowthDataPoints?: FetalGrowthPoint[];
}
interface FooterVisibilityOptions {
  showDoctorPhoneInPdf?: boolean;
  showDoctorEmailInPdf?: boolean;
}

// ─── Sanitizer + utils ────────────────────────────────────────────────────────
function san(t: string): string {
  if (!t) return "";
  const M: Record<number, string> = {
    224: "a'", 232: "e'", 233: "e'", 236: "i'", 242: "o'", 249: "u'",
    192: "A'", 200: "E'", 201: "E'", 204: "I'", 210: "O'", 217: "U'",
  };
  let r = "";
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    if (M[c]) { r += M[c]; continue; }
    if (c === 195 && i + 1 < t.length) {
      const n = t.charCodeAt(i + 1);
      const U: Record<number, string> = { 160: "a'", 168: "e'", 169: "e'", 172: "i'", 178: "o'", 185: "u'" };
      if (U[n]) { r += U[n]; i++; continue; }
    }
    r += t[i];
  }
  return r;
}

function fd(d: string): string {
  if (!d) return "-";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "-" : dt.toLocaleDateString("it-IT");
}
function calcAge(dob: string): string {
  if (!dob) return "";
  const b = new Date(dob); if (isNaN(b.getTime())) return "";
  const t = new Date(); let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return String(a);
}
function v(x: string | number | undefined | null, fb = "-"): string {
  return (x === undefined || x === null || String(x).trim() === "") ? fb : String(x);
}

/** True se il valore mostrato indica "campo non inserito": la riga non va stampata nel PDF. */
function isInquadramentoValueEmpty(val: string): boolean {
  if (!val || String(val).trim() === "") return true;
  const s = String(val).trim();
  if (s === "-") return true;
  if (s === "0") return true;
  if (s === "0 (0 PS, 0 TC)" || s === "0 (0 AS, 0 IVG)") return true;
  if (s === "- / -" || s === "- / - kg") return true;
  if (s === "- fumo, - acido folico") return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
export class PdfService {

  private static fCtx: { doctor: Doctor | null; opts: FooterVisibilityOptions } | null = null;

  private static fc(d: jsPDF, c: readonly number[]) { d.setFillColor(c[0], c[1], c[2]); }
  private static dc(d: jsPDF, c: readonly number[]) { d.setDrawColor(c[0], c[1], c[2]); }
  private static tc(d: jsPDF, c: readonly number[]) { d.setTextColor(c[0], c[1], c[2]); }

  // ── page break ───────────────────────────────────────────────────────────────
  private static pb(doc: jsPDF, y: number, need = 30): number {
    if (y + need > FOOT_Y - 8) {
      if (this.fCtx) this.drawFooter(doc, this.fCtx.doctor, this.fCtx.opts);
      doc.addPage(); return 18;
    }
    return y;
  }

  // ── multiline text block ─────────────────────────────────────────────────────
  /** textStyle: ripristina font/size/colore prima di ogni riga (necessario dopo salto pagina, perché drawFooter cambia lo stile). */
  private static block(
    doc: jsPDF,
    text: string,
    x: number,
    y: number,
    maxW: number,
    lh = LH,
    textStyle?: { font?: "helvetica" | "times"; style?: "normal" | "bold" | "italic"; fontSize?: number; color?: readonly number[] },
  ): number {
    if (!text?.trim()) return y;
    const lines: string[] = doc.splitTextToSize(san(text), maxW);
    for (const line of lines) {
      y = this.pb(doc, y, lh + 1);
      if (textStyle) {
        doc.setFont(textStyle.font ?? "helvetica", textStyle.style ?? "normal");
        if (textStyle.fontSize != null) doc.setFontSize(textStyle.fontSize);
        if (textStyle.color) this.tc(doc, textStyle.color);
      }
      doc.text(line, x, y);
      y += lh;
    }
    return y;
  }

  // ── horizontal rule ──────────────────────────────────────────────────────────
  private static rule(doc: jsPDF, y: number, x1 = ML, x2 = MR, lw = 0.2) {
    this.dc(doc, K200); doc.setLineWidth(lw); doc.line(x1, y, x2, y);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TABLE ENGINE — widths must exactly sum to PW (180mm)
  // ─────────────────────────────────────────────────────────────────────────────
  private static table(
    doc: jsPDF, y: number,
    cols: { header: string; w: number }[],
    rows: string[][],
    opts?: { rowH?: number; fontSize?: number; headerFontSize?: number },
  ): number {
    const ROW_H = opts?.rowH ?? 7;
    const FONT = opts?.fontSize ?? 8.5;
    const HFONT = opts?.headerFontSize ?? 7.5;
    const PAD = 1.8;
    const totalW = cols.reduce((s, c) => s + c.w, 0);

    y = this.pb(doc, y, ROW_H * (rows.length + 1) + 4);

    // header
    this.fc(doc, K235); doc.rect(ML, y, totalW, ROW_H, "F");
    this.dc(doc, K200); doc.setLineWidth(0.2); doc.rect(ML, y, totalW, ROW_H, "S");
    doc.setFont("helvetica", "bold"); doc.setFontSize(HFONT); this.tc(doc, K30);
    let cx = ML;
    cols.forEach(col => {
      if (cx > ML) { this.dc(doc, K200); doc.setLineWidth(0.15); doc.line(cx, y, cx, y + ROW_H); }
      const lines = doc.splitTextToSize(san(col.header), col.w - PAD * 2);
      doc.text(lines[0] ?? '', cx + PAD, y + ROW_H / 2 + HFONT * 0.18, { baseline: "middle" });
      cx += col.w;
    });
    y += ROW_H;

    // rows
    rows.forEach(row => {
      y = this.pb(doc, y, ROW_H + 2);
      this.dc(doc, K200); doc.setLineWidth(0.15); doc.rect(ML, y, totalW, ROW_H, "S");
      cx = ML;
      doc.setFont("helvetica", "normal"); doc.setFontSize(FONT); this.tc(doc, K30);
      cols.forEach((col, ci) => {
        if (cx > ML) { this.dc(doc, K200); doc.setLineWidth(0.15); doc.line(cx, y, cx, y + ROW_H); }
        const cellLines = doc.splitTextToSize(san(v(row[ci])), col.w - PAD * 2);
        doc.text(cellLines[0] ?? '', cx + PAD, y + ROW_H / 2 + FONT * 0.18, { baseline: "middle" });
        cx += col.w;
      });
      y += ROW_H;
    });

    return y + 3;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PERCENTILE BAR  |----+-------◆--|  78°
  //
  // Draws the inline graphic exactly like the Careggi reference document.
  // bx, by  = left edge, vertical center of bar
  // barW    = total available width for the bar graphic (e.g. 55mm)
  // p5/p50/p95 = centile reference values
  // patVal  = patient's measured value
  // ─────────────────────────────────────────────────────────────────────────────
  private static drawPercentileBar(
    doc: jsPDF,
    bx: number, by: number, barW: number,
    p5: number, p50: number, p95: number,
    patVal: number,
  ): void {
    // The bar line runs from x0 to x1, with some padding inside barW
    const PAD_L = 3;
    const PAD_R = 16;  // space for centile text on the right
    const lineX0 = bx + PAD_L;
    const lineX1 = bx + barW - PAD_R;
    const lineW = lineX1 - lineX0;

    // Map a measurement value to X position (clamped to bar range)
    const toX = (val: number): number => {
      const frac = (val - p5) / (p95 - p5);
      return lineX0 + Math.min(1, Math.max(0, frac)) * lineW;
    };

    const midY = by;

    // ── horizontal bar line ──
    this.dc(doc, K30); doc.setLineWidth(0.35);
    doc.line(lineX0, midY, lineX1, midY);

    // ── end ticks  |  ──
    const tickH = 1.4;
    doc.setLineWidth(0.35);
    doc.line(lineX0, midY - tickH, lineX0, midY + tickH); // left |
    doc.line(lineX1, midY - tickH, lineX1, midY + tickH); // right |

    // ── P50 middle tick  +  ──
    const x50 = toX(p50);
    doc.setLineWidth(0.3);
    doc.line(x50, midY - tickH * 1.1, x50, midY + tickH * 1.1);

    // ── patient diamond marker  ◆ ──
    const xPat = toX(patVal);
    const dSize = 1.6;  // half-diagonal of diamond
    this.fc(doc, K30); this.dc(doc, K30); doc.setLineWidth(0.1);
    // draw a rotated square (diamond) using polygon
    doc.moveTo(xPat, midY - dSize);
    doc.lineTo(xPat + dSize, midY);
    doc.lineTo(xPat, midY + dSize);
    doc.lineTo(xPat - dSize, midY);
    doc.lineTo(xPat, midY - dSize);
    (doc as any).fillStroke();

    // ── centile % text ──
    const rank = estimateCentileRank(patVal, p5, p50, p95);
    const cat = getGrowthCategory(rank);
    let pctStr = formatCentileLabel(rank);

    if (cat !== "AGA") {
      pctStr += ` (${cat})`; // es. "5° (SGA)"
      doc.setFont("helvetica", "bold");
      // Se vuoi rosso: this.tc(doc, [180, 0, 0]);
    } else {
      doc.setFont("helvetica", "normal");
      this.tc(doc, K30);
    }

    doc.setFontSize(7);
    doc.text(pctStr, lineX1 + 2, midY + 1);

    // Ripristino stile base
    doc.setFont("helvetica", "normal");
    this.tc(doc, K30);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BIOMETRIA TABLE WITH INLINE PERCENTILE BARS
  //
  // Layout per riga:
  //  Col A: nome misura   18mm
  //  Col B: valore        30mm
  //  Col C: barra %       52mm   ← |----+----◆----|  78%
  // Totale colonne A+B+C = 100mm  (metà pagina)
  //
  // Due misure affiancate per riga → DBP+CC, CA+FL, poi EFW a piena larghezza
  //  Sinistra: ML … ML+100
  //  Destra:   ML+100 … ML+180 (i.e. ML+100 … MR)
  // ─────────────────────────────────────────────────────────────────────────────
  private static drawBiometriaTable(
    doc: jsPDF, y: number,
    gaWeeks: number | null,
    bpd: number, hc: number, ac: number, fl: number,
    efwGrams: number,
  ): number {
    // Collect non-zero measurements
    type BioItem = {
      label: string;
      unit: string;
      val: number;
      centiles: CentilePoint[];
    };
    const items: BioItem[] = [];
    if (bpd > 0) items.push({ label: "DBP", unit: "mm", val: bpd, centiles: BPD_CENTILES });
    if (hc > 0) items.push({ label: "CC", unit: "mm", val: hc, centiles: HC_CENTILES });
    if (ac > 0) items.push({ label: "CA", unit: "mm", val: ac, centiles: AC_CENTILES });
    if (fl > 0) items.push({ label: "FL", unit: "mm", val: fl, centiles: FL_CENTILES });

    const hasEfw = efwGrams > 0;
    if (!items.length && !hasEfw) return y;

    y = this.pb(doc, y, 12 + Math.ceil(items.length / 2) * 8 + (hasEfw ? 8 : 0) + 4);

    // Section heading
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); this.tc(doc, K0);
    doc.text("Biometria fetale", ML, y);
    this.rule(doc, y + 1.2, ML, ML + doc.getTextWidth("Biometria fetale"), 0.4);
    y += 5.5;

    // ── column widths ──
    // Two blocks side by side, each 90mm wide.
    // Within each block:  label=18 | value=22 | bar=50  → 90mm
    const BLOCK_W = 90;      // each side
    const COL_A = 18;      // label
    const COL_B = 22;      // value
    const COL_C = BLOCK_W - COL_A - COL_B;  // bar = 50mm
    const ROW_H = 8;
    const PAD = 1.8;

    const drawHeaderBlock = (bx: number) => {
      this.fc(doc, K235);
      doc.rect(bx, y, BLOCK_W, ROW_H, "F");
      this.dc(doc, K200); doc.setLineWidth(0.2);
      doc.rect(bx, y, BLOCK_W, ROW_H, "S");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); this.tc(doc, K30);
      doc.text("Misura", bx + PAD, y + ROW_H / 2 + 0.5, { baseline: "middle" });
      this.dc(doc, K200); doc.setLineWidth(0.15);
      doc.line(bx + COL_A, y, bx + COL_A, y + ROW_H);
      doc.text("Valore", bx + COL_A + PAD, y + ROW_H / 2 + 0.5, { baseline: "middle" });
      doc.line(bx + COL_A + COL_B, y, bx + COL_A + COL_B, y + ROW_H);
      doc.text("Percentile", bx + COL_A + COL_B + PAD, y + ROW_H / 2 + 0.5, { baseline: "middle" });
    };

    // Determine layout: how many rows
    const rowCount = Math.ceil(items.length / 2);

    // Draw headers for both blocks
    if (items.length > 0) {
      drawHeaderBlock(ML);
      if (items.length > 1) drawHeaderBlock(ML + BLOCK_W);
      // vertical separator between blocks
      this.dc(doc, K200); doc.setLineWidth(0.2);
      doc.line(ML + BLOCK_W, y, ML + BLOCK_W, y + ROW_H + rowCount * ROW_H);
    }
    y += ROW_H;

    // Draw data rows, 2 items per row
    for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
      y = this.pb(doc, y, ROW_H + 2);

      [0, 1].forEach(side => {
        const itemIdx = rowIdx * 2 + side;
        if (itemIdx >= items.length) return;
        const item = items[itemIdx];
        const bx = ML + side * BLOCK_W;

        // row border
        this.dc(doc, K200); doc.setLineWidth(0.15);
        doc.rect(bx, y, BLOCK_W, ROW_H, "S");

        // Col A — label
        doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); this.tc(doc, K30);
        doc.text(san(item.label), bx + PAD, y + ROW_H / 2 + 0.5, { baseline: "middle" });
        this.dc(doc, K200); doc.setLineWidth(0.15);
        doc.line(bx + COL_A, y, bx + COL_A, y + ROW_H);

        // Col B — value
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); this.tc(doc, K30);
        doc.text(`${item.val} ${item.unit}`, bx + COL_A + PAD, y + ROW_H / 2 + 0.5, { baseline: "middle" });
        doc.line(bx + COL_A + COL_B, y, bx + COL_A + COL_B, y + ROW_H);

        // Col C — percentile bar (only if we have GA)
        if (gaWeeks !== null) {
          const ref = interpolateCentile(item.centiles, gaWeeks);
          if (ref) {
            this.drawPercentileBar(
              doc,
              bx + COL_A + COL_B,
              y + ROW_H / 2,
              COL_C,
              ref.p5, ref.p50, ref.p95,
              item.val,
            );
          }
        }
      });

      y += ROW_H;
    }

    // ── EFW row — full width (180mm) ──────────────────────────────────────────
    if (hasEfw) {
      const EFW_COL_A = 52;   // label (largo per "PSF - Peso Stimato Fetale" senza toccare la riga)
      const EFW_COL_B = 44;   // value
      const EFW_COL_C = PW - EFW_COL_A - EFW_COL_B;  // bar

      y = this.pb(doc, y, ROW_H * 2 + 2);

      // header
      this.fc(doc, K235); doc.rect(ML, y, PW, ROW_H, "F");
      this.dc(doc, K200); doc.setLineWidth(0.2); doc.rect(ML, y, PW, ROW_H, "S");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); this.tc(doc, K30);
      doc.text("Calcolo del peso fetale", ML + PAD, y + ROW_H / 2 + 0.5, { baseline: "middle" });
      y += ROW_H;

      // data row
      y = this.pb(doc, y, ROW_H + 2);
      this.dc(doc, K200); doc.setLineWidth(0.15); doc.rect(ML, y, PW, ROW_H, "S");

      // label (con larghezza max per non sovrapporsi alla riga verticale)
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); this.tc(doc, K30);
      const efwLabel = "PSF - Peso Stimato Fetale";
      const efwLabelW = EFW_COL_A - PAD * 2;
      const efwLabelLines = doc.splitTextToSize(san(efwLabel), efwLabelW);
      doc.text(efwLabelLines[0] ?? efwLabel, ML + PAD, y + ROW_H / 2 + 0.5, { baseline: "middle" });
      this.dc(doc, K200); doc.setLineWidth(0.15);
      doc.line(ML + EFW_COL_A, y, ML + EFW_COL_A, y + ROW_H);

      // value
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); this.tc(doc, K30);

      // compute centile label for EFW using shared Hadlock-based table (same as UI)
      let efwCentileStr = "";
      let efwRank: number | null = null;
      if (gaWeeks !== null) {
        efwRank = getCentileForWeight(efwGrams, gaWeeks);
        if (efwRank !== null) {
          const cat = getGrowthCategory(efwRank);
          efwCentileStr = ` (${formatCentileLabel(efwRank)} centile${cat !== "AGA" ? ` - ${cat}` : ""})`;
        }
      }
      doc.text(`${efwGrams} g${efwCentileStr}`, ML + EFW_COL_A + PAD, y + ROW_H / 2 + 0.5, { baseline: "middle" });
      doc.line(ML + EFW_COL_A + EFW_COL_B, y, ML + EFW_COL_A + EFW_COL_B, y + ROW_H);

      // grafico a barre del percentile
      if (gaWeeks !== null) {
        const pesoRef = getWeightPercentiles(gaWeeks);
        if (pesoRef) {
          this.drawPercentileBar(
            doc,
            ML + EFW_COL_A + EFW_COL_B,
            y + ROW_H / 2,
            EFW_COL_C,
            pesoRef.p5, pesoRef.p50, pesoRef.p95,
            efwGrams,
          );
        }
      }

      y += ROW_H;

      // formula note sotto la riga, per evitare sovrapposizione con la barra
      doc.setFont("helvetica", "italic"); doc.setFontSize(6.5); this.tc(doc, K140);
      doc.text("EFW per Hadlock (DBP-CC-CA-FL)", ML + PAD, y + 3);
      y += 5;
    }

    return y + 3;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION HEADING
  // ─────────────────────────────────────────────────────────────────────────────
  private static heading(doc: jsPDF, y: number, text: string): number {
    y = this.pb(doc, y, 12);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); this.tc(doc, K0);
    doc.text(san(text), ML, y);
    this.rule(doc, y + 1.2, ML, ML + doc.getTextWidth(san(text)), 0.4);
    return y + 5.5;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DOCUMENT HEADER
  // ─────────────────────────────────────────────────────────────────────────────
  private static drawHeader(
    doc: jsPDF, title: string, subtitle: string,
    doctor: Doctor | null, showDoctor = true
  ): number {
    let y = 16;
    if (showDoctor && doctor) {
      doc.setFont("times", "bold"); doc.setFontSize(14); this.tc(doc, K0);
      doc.text(san(`Dott. ${doctor.nome} ${doctor.cognome}`.toUpperCase()), 105, y, { align: "center" });
      y += 5.5;
      if (doctor.specializzazione) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); this.tc(doc, K80);
        doc.text(san(doctor.specializzazione), 105, y, { align: "center" });
        y += 4.5;
      }
    } else if (showDoctor) {
      doc.setFont("times", "bold"); doc.setFontSize(14); this.tc(doc, K0);
      doc.text("STUDIO MEDICO", 105, y, { align: "center" }); y += 9;
    }
    this.rule(doc, y, ML, MR, 0.5); y += 5;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); this.tc(doc, K0);
    doc.text(san(title), 105, y, { align: "center" }); y += 5;
    if (subtitle) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); this.tc(doc, K80);
      doc.text(san(subtitle), 105, y, { align: "center" }); y += 4;
    }
    this.rule(doc, y, ML, MR, 0.3);
    return y + 4;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATIENT BLOCK
  // ─────────────────────────────────────────────────────────────────────────────
  private static drawPatientBlock(
    doc: jsPDF, patient: Patient, visitDate: string,
    y: number, dateLabel = "Data visita"
  ): number {
    const a = calcAge(patient.dataNascita);
    const dob = patient.dataNascita
      ? `${fd(patient.dataNascita)}${a ? `  (${a} anni)` : ""}` : "-";

    const left: { label: string; value: string }[] = [
      { label: "Paziente", value: `${patient.nome} ${patient.cognome}` },
      { label: "Data di nascita", value: dob },
      ...(patient.codiceFiscale?.trim() ? [{ label: "Cod. Fiscale", value: patient.codiceFiscale }] : []),
    ];
    const right: { label: string; value: string }[] = [
      { label: dateLabel, value: fd(visitDate) },
      ...(patient.sesso ? [{ label: "Sesso", value: patient.sesso }] : []),
    ];

    const halfW = PW / 2 - 4;
    let ly = y, ry = y;

    for (const item of left) {
      if (!item.value || item.value === "-") continue;
      ly = this.pb(doc, ly, LH + 1);
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); this.tc(doc, K80);
      const lbl = san(item.label) + ": ";
      doc.text(lbl, ML, ly);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); this.tc(doc, K0);
      const lblWidth = doc.getTextWidth(lbl);
      const valueX = ML + lblWidth + 1; // piccolo margine tra titolo e valore
      const vlines = doc.splitTextToSize(san(item.value), halfW - lblWidth - 3);
      doc.text(vlines[0] ?? "", valueX, ly); ly += LH;
      for (let i = 1; i < vlines.length; i++) {
        doc.text(vlines[i], valueX, ly);
        ly += LH;
      }
    }
    for (const item of right) {
      if (!item.value || item.value === "-") continue;
      ry = this.pb(doc, ry, LH + 1);
      const rx = ML + PW / 2 + 4;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); this.tc(doc, K80);
      const lbl = san(item.label) + ": ";
      doc.text(lbl, rx, ry);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); this.tc(doc, K0);
      const lblWidth = doc.getTextWidth(lbl);
      const valueX = rx + lblWidth + 1; // piccolo margine tra titolo e valore
      doc.text(san(item.value), valueX, ry);
      ry += LH;
    }

    y = Math.max(ly, ry) + 2;
    this.rule(doc, y, ML, MR, 0.3);
    return y + 4;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TEXT SECTION
  // ─────────────────────────────────────────────────────────────────────────────
  private static drawTextSection(
    doc: jsPDF, y: number, title: string,
    content: string | undefined | null, note?: string
  ): number {
    if (!content?.trim()) return y;
    y = this.pb(doc, y, 14);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); this.tc(doc, K0);
    doc.text(san(title), ML, y);
    this.rule(doc, y + 1.5, ML, MR, 0.25); y += 5.5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); this.tc(doc, K30);
    y = this.block(doc, content, ML + 1, y, PW - 2, LH, {
      font: "helvetica", style: "normal", fontSize: 9.5, color: K30,
    });
    if (note) {
      y += 1.5;
      doc.setFont("helvetica", "italic"); doc.setFontSize(7); this.tc(doc, K140);
      y = this.block(doc, note, ML + 1, y, PW - 2, 3.8, {
        font: "helvetica", style: "italic", fontSize: 7, color: K140,
      });
    }
    return y + 4;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BIOMETRIC GROWTH CHARTS (DBP, CC, CA, FL)
  // ─────────────────────────────────────────────────────────────────────────────
  private static drawBiometricCharts(
    doc: jsPDF, points: FetalGrowthPoint[], y: number
  ): number {
    // Need space for title + 2 rows of charts (approx 100mm total)
    y = this.pb(doc, y, 105);

    doc.setFont("helvetica", "bold"); doc.setFontSize(9); this.tc(doc, K0);
    doc.text("Curve di crescita biometrica (DBP, CC, CA, FL)", 105, y, { align: "center" });
    y += 5;
    doc.setFont("helvetica", "italic"); doc.setFontSize(6.5); this.tc(doc, K140);
    doc.text("Curve di riferimento: Hadlock. Valori in mm.", 105, y, { align: "center" });
    y += 6;

    const GAP = 8;
    const ROW_H = 42;
    const CW = (PW - GAP) / 2; // ~86mm
    const AX_L = 10;
    const AX_B = 6;
    const PLOT_W = CW - AX_L;
    const PLOT_H = ROW_H - AX_B - 5;

    // Helper to draw a single chart
    const drawOne = (
      bx: number, by: number,
      title: string,
      centiles: CentilePoint[],
      yMax: number,
      key: keyof FetalGrowthPoint
    ) => {
      // Background frame
      this.dc(doc, K200); doc.setLineWidth(0.2);
      doc.rect(bx + AX_L, by, PLOT_W, PLOT_H, "S");

      // X Axis range: 14 to 40 weeks
      const minW = 14, maxW = 40;
      const toX = (w: number) => bx + AX_L + ((w - minW) / (maxW - minW)) * PLOT_W;
      const toY = (v: number) => by + PLOT_H - (Math.max(0, Math.min(yMax, v)) / yMax) * PLOT_H;

      // Grid lines - X
      doc.setDrawColor(230, 230, 230); doc.setLineWidth(0.08);
      for (let w = 16; w <= 40; w += 4) {
        doc.line(toX(w), by, toX(w), by + PLOT_H);
      }
      // Grid lines - Y
      const steps = 4;
      for (let i = 1; i < steps; i++) {
        const yy = by + PLOT_H - (PLOT_H / steps) * i;
        doc.line(bx + AX_L, yy, bx + AX_L + PLOT_W, yy);
      }

      // Title
      doc.setFont("helvetica", "bold"); doc.setFontSize(7); this.tc(doc, K80);
      doc.text(title, bx + AX_L + PLOT_W / 2, by - 1.5, { align: "center" });

      // Labels X
      doc.setFont("helvetica", "normal"); doc.setFontSize(5.5); this.tc(doc, K140);
      for (let w = 14; w <= 40; w += 4) {
        if (w === 14) continue; // skip first label collision
        doc.text(String(w), toX(w), by + PLOT_H + 3, { align: "center" });
      }
      // Labels Y
      for (let i = 0; i <= steps; i++) {
        const val = Math.round((yMax / steps) * i);
        const yy = by + PLOT_H - (val / yMax) * PLOT_H;
        doc.text(String(val), bx + AX_L - 1.5, yy + 1, { align: "right" });
      }

      // Draw Curves (p5, p50, p95)
      const weeks = Array.from({ length: maxW - minW + 1 }, (_, i) => minW + i);

      const drawCurve = (pKey: 'p5' | 'p50' | 'p95', color: readonly number[], lw: number) => {
        doc.setDrawColor(color[0], color[1], color[2]);
        doc.setLineWidth(lw);
        for (let i = 0; i < weeks.length - 1; i++) {
          const w1 = weeks[i];
          const w2 = weeks[i + 1];
          const c1 = interpolateCentile(centiles, w1);
          const c2 = interpolateCentile(centiles, w2);
          if (c1 && c2) {
            doc.line(toX(w1), toY(c1[pKey]), toX(w2), toY(c2[pKey]));
          }
        }
      };

      drawCurve('p5', K200, 0.15);
      drawCurve('p50', K80, 0.25);
      drawCurve('p95', K200, 0.15);

      // Draw Patient Points
      const validPoints = points
        .filter(p => p.gaWeeks >= minW && p.gaWeeks <= maxW && (p[key] as number) > 0)
        .sort((a, b) => a.gaWeeks - b.gaWeeks);

      if (validPoints.length > 0) {
        // Lines
        this.dc(doc, K0); doc.setLineWidth(0.35);
        for (let i = 0; i < validPoints.length - 1; i++) {
          const p1 = validPoints[i];
          const p2 = validPoints[i + 1];
          doc.line(toX(p1.gaWeeks), toY(p1[key] as number), toX(p2.gaWeeks), toY(p2[key] as number));
        }
        // Dots
        validPoints.forEach((p, idx) => {
          const isLast = idx === validPoints.length - 1;
          const px = toX(p.gaWeeks);
          const py = toY(p[key] as number);
          if (isLast) {
            this.dc(doc, K0); this.fc(doc, K0);
            doc.circle(px, py, 1.0, "FD");
          } else {
            this.dc(doc, K140); this.fc(doc, K235);
            doc.circle(px, py, 0.8, "FD");
          }
        });
      }
    };

    // Row 1
    drawOne(ML, y, "DBP", BPD_CENTILES, 110, "bpdMm");
    drawOne(ML + CW + GAP, y, "CC", HC_CENTILES, 380, "hcMm");

    y += ROW_H + 4;

    // Row 2
    drawOne(ML, y, "CA", AC_CENTILES, 420, "acMm");
    drawOne(ML + CW + GAP, y, "FL", FL_CENTILES, 90, "flMm");

    return y + ROW_H + 8;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // IMAGE GALLERY
  // ─────────────────────────────────────────────────────────────────────────────
  private static toJpeg(url: string): Promise<string> {
    return new Promise((res, rej) => {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0);
        res(c.toDataURL("image/jpeg", 0.88));
      };
      img.onerror = () => rej(new Error("fail")); img.src = url;
    });
  }

  private static async drawImages(doc: jsPDF, imgs: string[] | undefined, y: number): Promise<number> {
    if (!imgs?.length) return y;
    y = this.heading(doc, y, "Immagini ecografia");
    const COLS = 2, GAP = 4, tW = (PW - GAP) / COLS, tH = 55;
    for (let i = 0; i < imgs.length; i += COLS) {
      y = this.pb(doc, y, tH + 6);
      const row = imgs.slice(i, i + COLS);
      const conv = await Promise.all(row.map(im => this.toJpeg(im).catch(() => null)));
      conv.forEach((img, col) => {
        const x = ML + col * (tW + GAP);
        this.dc(doc, K200); doc.setLineWidth(0.2); doc.rect(x, y, tW, tH, "S");
        if (img) {
          try {
            const p = (doc as any).getImageProperties(img);
            const r = p.width / p.height;
            let w = tW - 3, h = w / r;
            if (h > tH - 3) { h = tH - 3; w = h * r; }
            doc.addImage(img, "JPEG", x + (tW - w) / 2, y + (tH - h) / 2, w, h);
          } catch {
            doc.setFont("helvetica", "italic"); doc.setFontSize(7); this.tc(doc, K140);
            doc.text("Immagine non disponibile", x + tW / 2, y + tH / 2, { align: "center" });
          }
        }
      });
      y += tH + 4;
    }
    return y + 4;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FOOTER
  // ─────────────────────────────────────────────────────────────────────────────
  private static drawFooter(doc: jsPDF, doctor: Doctor | null, vis?: FooterVisibilityOptions) {
    this.rule(doc, FOOT_Y, ML + 10, MR - 10, 0.2);
    const parts: string[] = [];
    if (doctor?.ambulatori?.length) {
      const a = doctor.ambulatori.find(x => x.isPrimario) || doctor.ambulatori[0];
      parts.push(san(`${a.nome} - ${a.indirizzo}, ${a.citta}`));
    }
    if (vis?.showDoctorPhoneInPdf !== false && doctor?.telefono) parts.push(`Tel: ${doctor.telefono}`);
    if (vis?.showDoctorEmailInPdf !== false && doctor?.email) parts.push(san(doctor.email));
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); this.tc(doc, K140);
    doc.text(parts.join("   |   "), 105, FOOT_Y + 5, { align: "center" });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FLAT NORMALISERS
  // ─────────────────────────────────────────────────────────────────────────────
  private static mkGyn(vv: Visit): NonNullable<Visit["ginecologia"]> {
    const t = [vv.conclusioniDiagnostiche, vv.terapie].filter(Boolean).join("\n");
    return {
      gravidanze: 0, parti: 0, aborti: 0, ultimaMestruazione: "", prestazione: vv.anamnesi ?? "",
      problemaClinico: vv.descrizioneClinica ?? "", chirurgiaPregessa: "", allergie: "", familiarita: "",
      terapiaInAtto: "", vaccinazioneHPV: true, esameBimanuale: vv.esamiObiettivo ?? "", speculum: "",
      ecografiaTV: "", accertamenti: "", conclusione: vv.conclusioniDiagnostiche ?? "",
      terapiaSpecifica: t, ecografiaImmagini: []
    };
  }
  private static mkObs(vv: Visit): NonNullable<Visit["ostetricia"]> {
    const t = [vv.conclusioniDiagnostiche, vv.terapie].filter(Boolean).join("\n");
    return {
      settimaneGestazione: "", ultimaMestruazione: "", dataPresunta: "", modalitaConcepimento: "",
      problemaClinico: vv.descrizioneClinica ?? "", gravidanzePrec: 0, partiPrec: 0, abortiPrec: 0,
      pesoPreGravidanza: 0, pesoAttuale: 0, pressioneArteriosa: "", fumaInGravidanza: "",
      pacchettiSigaretteAlGiorno: 0, assunzioneAcidoFolico: "", altezzaUterina: "", battitiFetali: "",
      movimentiFetali: "", esamiEseguiti: "", ecografiaOffice: vv.esamiObiettivo ?? "",
      noteOstetriche: t, prestazione: vv.anamnesi ?? "", esameObiettivo: vv.esamiObiettivo ?? "",
      ecografiaImmagini: [], biometriaFetale: { bpdMm: 0, hcMm: 0, acMm: 0, flMm: 0 }
    };
  }
  private static norm(visit: Visit): Visit {
    const isG = visit.tipo === "ginecologica" || visit.tipo === "ginecologica_pediatrica";
    const isO = visit.tipo === "ostetrica";
    const g = visit.ginecologia ?? (isG ? this.mkGyn(visit) : undefined);
    const o = visit.ostetricia ?? (isO ? this.mkObs(visit) : undefined);
    return (g || o) ? { ...visit, ginecologia: g, ostetricia: o } : visit;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── VISITA GINECOLOGICA ───────────────────────────────────────────────────
  static async generateGynecologicalPDF(patient: Patient, visit: Visit, options?: VisitPdfOptions) {
    const nv = this.norm(visit); if (!nv.ginecologia) return;
    const gyn = nv.ginecologia;
    const isPed = visit.tipo === "ginecologica_pediatrica";

    const [doctor, prefs] = await Promise.all([DoctorService.getDoctor(), PreferenceService.getPreferences()]);
    const fo: FooterVisibilityOptions = {
      showDoctorPhoneInPdf: prefs?.showDoctorPhoneInPdf as boolean | undefined,
      showDoctorEmailInPdf: prefs?.showDoctorEmailInPdf as boolean | undefined,
    };
    this.fCtx = { doctor, opts: fo };
    const doc = new jsPDF();

    let y = this.drawHeader(doc,
      isPed ? "VISITA GINECOLOGICA PEDIATRICA" : "VISITA GINECOLOGICA",
      "Referto Specialistico", doctor);
    y = this.drawPatientBlock(doc, patient, visit.dataVisita, y);

    const partiV = gyn.partiSpontanei != null || gyn.partiCesarei != null
      ? `${gyn.parti} (${gyn.partiSpontanei ?? 0} PS, ${gyn.partiCesarei ?? 0} TC)` : String(gyn.parti);
    const abortiV = gyn.abortiSpontanei != null || gyn.ivg != null
      ? `${gyn.aborti} (${gyn.abortiSpontanei ?? 0} AS, ${gyn.ivg ?? 0} IVG)` : String(gyn.aborti);

    if (!isPed) {
      y = this.heading(doc, y, "Dati anamnestici");
      y = this.table(doc, y, [
        { header: "Gravidanze (G)", w: 40 },
        { header: "Parti (P)", w: 55 },
        { header: "Aborti (A)", w: 55 },
        { header: "Ultima Mestruazione", w: 30 },
      ], [[String(gyn.gravidanze), partiV, abortiV,
      gyn.ultimaMestruazione?.trim() ? fd(gyn.ultimaMestruazione) : "-"]], { rowH: 8 });
    } else {
      y = this.heading(doc, y, "Dati anamnestici");
      y = this.table(doc, y, [
        { header: "Menarca", w: 60 },
        { header: "Vaccinazione HPV", w: 60 },
        { header: "Stadio Tanner (F)", w: 60 },
      ], [[gyn.menarca ?? "-", gyn.vaccinazioneHPV ? "Si'" : "No", gyn.stadioTannerFemmina ?? "-"]], { rowH: 8 });
    }

    const SIEOG = "Ecografia Office di supporto alla visita clinica. Non sostituisce le ecografie di screening previste dalle Linee Guida SIEOG, e di cio' si informa la persona assistita.";
    y = this.drawTextSection(doc, y, "Anamnesi", gyn.prestazione);
    y = this.drawTextSection(doc, y, "Descrizione Problema / Dati Clinici", gyn.problemaClinico);
    y = this.drawTextSection(doc, y, "Visita / Ecografia Office", gyn.esameBimanuale, SIEOG);
    if (options?.includeEcografiaImages) y = await this.drawImages(doc, gyn.ecografiaImmagini, y);
    y = this.drawTextSection(doc, y, "Conclusioni e Terapia", gyn.terapiaSpecifica);

    try { this.drawFooter(doc, doctor, fo); return doc.output("blob") as Blob; }
    finally { this.fCtx = null; }
  }

  // ─── VISITA OSTETRICA ──────────────────────────────────────────────────────
  static async generateObstetricPDF(patient: Patient, visit: Visit, options?: VisitPdfOptions) {
    const nv = this.norm(visit); if (!nv.ostetricia) return;
    const obs = nv.ostetricia;

    const [doctor, prefs] = await Promise.all([DoctorService.getDoctor(), PreferenceService.getPreferences()]);
    const fo: FooterVisibilityOptions = {
      showDoctorPhoneInPdf: prefs?.showDoctorPhoneInPdf as boolean | undefined,
      showDoctorEmailInPdf: prefs?.showDoctorEmailInPdf as boolean | undefined,
    };
    this.fCtx = { doctor, opts: fo };
    const formula = (prefs?.formulaPesoFetale as string) || "hadlock4";
    const doc = new jsPDF();

    let y = this.drawHeader(doc, "VISITA OSTETRICA", "Monitoraggio della Gravidanza", doctor);
    y = this.drawPatientBlock(doc, patient, visit.dataVisita, y);

    // ── calcoli ───────────────────────────────────────────────────────────────
    const bio = obs.biometriaFetale ?? { bpdMm: 0, hcMm: 0, acMm: 0, flMm: 0 };
    const stime = calcolaStimePesoFetale(bio);
    const stima = stime[formula] ?? stime.hadlock4;
    const ga = parseGestationalWeeks(obs.settimaneGestazione ?? "");

    const efwGrams = (stima?.calcolabile && stima.pesoGrammi != null) ? stima.pesoGrammi : 0;

    const patAltezza = patient?.altezza ?? 0;
    const hasH = patAltezza > 0;
    const bmiPre = hasH && Number(obs.pesoPreGravidanza) > 0
      ? (Number(obs.pesoPreGravidanza) / Math.pow(patAltezza / 100, 2)).toFixed(1) : "-";
    const bmiNow = hasH && Number(obs.pesoAttuale) > 0
      ? (Number(obs.pesoAttuale) / Math.pow(patAltezza / 100, 2)).toFixed(1) : "-";
    const delta = obs.pesoAttuale && obs.pesoPreGravidanza
      ? `${(Number(obs.pesoAttuale) - Number(obs.pesoPreGravidanza)).toFixed(1)} kg` : "-";

    const fumaMap: Record<string, string> = {
      no: "No", meno_1: "<1 pacc./gg", "1": "1 pacc./gg", "2": "2 pacc./gg",
      "3": "3 pacc./gg", "4": "4 pacc./gg", "5_plus": "5+ pacc./gg",
    };
    const fumo = obs.fumaInGravidanza ? (fumaMap[obs.fumaInGravidanza] ?? obs.fumaInGravidanza)
      : obs.pacchettiSigaretteAlGiorno ? `${obs.pacchettiSigaretteAlGiorno} pacc./gg` : "-";
    const folico = obs.assunzioneAcidoFolico === "si" ? "Si'" : obs.assunzioneAcidoFolico === "no" ? "No" : "-";
    const concMap: Record<string, string> = {
      spontaneo: "Spontaneo", fivet: "FIVET", icsi: "ICSI",
      iui: "IUI/Inseminazione", donazione_ovociti: "Donazione ovociti", altra: "Altra",
    };
    const concep = obs.modalitaConcepimento ? (concMap[obs.modalitaConcepimento] ?? obs.modalitaConcepimento) : "-";
    const partiV = obs.partiPrecSpontanei != null || obs.partiPrecCesarei != null
      ? `${obs.partiPrec} (${obs.partiPrecSpontanei ?? 0} PS, ${obs.partiPrecCesarei ?? 0} TC)` : String(obs.partiPrec);
    const abortiV = obs.abortiPrecSpontanei != null || obs.ivgPrec != null
      ? `${obs.abortiPrec} (${obs.abortiPrecSpontanei ?? 0} AS, ${obs.ivgPrec ?? 0} IVG)` : String(obs.abortiPrec);

    // ── INQUADRAMENTO OSTETRICO E MATERNO (solo campi con valore) ─────────────────
    const dateInfo = [
      { label: "U.M.", value: fd(obs.ultimaMestruazione) },
      { label: "D.P.P.", value: fd(obs.dataPresunta) },
      { label: "Epoca", value: v(obs.settimaneGestazione) },
      { label: "Concepimento", value: concep },
    ].filter((item) => !isInquadramentoValueEmpty(item.value));

    const historyInfo = [
      { label: "Gravidanze (G)", value: String(obs.gravidanzePrec) },
      { label: "Parti (P)", value: partiV },
      { label: "Aborti (A)", value: abortiV },
    ].filter((item) => !isInquadramentoValueEmpty(item.value));

    const materniInfo = [
      { label: "Pesi (Pre/Att)", value: `${obs.pesoPreGravidanza || '-'} / ${obs.pesoAttuale || '-'} kg` },
      { label: "Incr. pond.", value: delta },
      { label: "BMI (Pre/Att)", value: `${bmiPre} / ${bmiNow}` },
      { label: "PA", value: v(obs.pressioneArteriosa) },
      { label: "Stile di vita", value: `${fumo} fumo, ${folico} acido folico` },
    ].filter((item) => !isInquadramentoValueEmpty(item.value));

    const allBlocks = [dateInfo, historyInfo, materniInfo];
    const hasAnyInquadramento = dateInfo.length > 0 || historyInfo.length > 0 || materniInfo.length > 0;

    if (hasAnyInquadramento) {
      y = this.heading(doc, y, "Inquadramento Ostetrico e Materno");
      y = this.pb(doc, y, 40);

      const colW = PW / 3;
      let maxY = y;

      const subHeaders = ["Datazione", "Storia Ostetrica", "Parametri Materni"];
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); this.tc(doc, K100);
      this.dc(doc, K200); doc.setLineWidth(0.2);

      for (let c = 0; c < 3; c++) {
        const cx = ML + c * colW;

        this.fc(doc, K240);
        doc.rect(cx, y, colW - 2, 6, "F");
        this.tc(doc, K30);
        doc.text(subHeaders[c], cx + 2, y + 4);

        let cy = y + 8;
        doc.setFontSize(8);

        for (const item of allBlocks[c]) {
          if (!item) continue;
          doc.setFont("helvetica", "bold"); this.tc(doc, K80);
          const lbl = san(item.label) + ": ";
          doc.text(lbl, cx, cy);

          doc.setFont("helvetica", "normal"); this.tc(doc, K0);
          const lblWidth = doc.getTextWidth(lbl);
          const valueX = cx + lblWidth + 1; // piccolo margine tra titolo e valore
          const vlines = doc.splitTextToSize(san(item.value), colW - lblWidth - 4);
          for (const line of vlines) {
            doc.text(line, valueX, cy);
            cy += LH;
          }
        }
        maxY = Math.max(maxY, cy);
      }

      y = maxY + 2;
    }

    // ── SEZIONE 4 — Biometria fetale con barre percentile inline ─────────────
    y = this.drawBiometriaTable(
      doc, y, ga,
      bio.bpdMm, bio.hcMm, bio.acMm, bio.flMm, efwGrams,
    );

    // ── SEZIONI TESTO LIBERO ─────────────────────────────────────────────────
    const SIEOG = "Ecografia Office di supporto alla visita clinica. Non sostituisce le ecografie di screening previste dalle Linee Guida SIEOG, e di cio' si informa la persona assistita.";
    y = this.drawTextSection(doc, y, "Anamnesi", obs.prestazione);
    y = this.drawTextSection(doc, y, "Dati clinici", obs.problemaClinico);
    y = this.drawTextSection(doc, y, "Ecografia Office / Esame obiettivo", obs.esameObiettivo, SIEOG);
    y = this.drawTextSection(doc, y, "Conclusioni e Terapia", obs.noteOstetriche);

    // ── CURVE BIOMETRICHE (opzionale) ─────────────────────────────────────────
    if (options?.includeFetalGrowthChart) {
      let pts = options.fetalGrowthDataPoints ? [...options.fetalGrowthDataPoints] : [];

      // Se non ci sono punti storici forniti, proviamo a costruire un punto dalla visita corrente
      if (pts.length === 0 && ga != null && ga >= 14 && ga <= 40) {
        pts.push({
          gaWeeks: ga,
          pesoGrammi: efwGrams,
          bpdMm: bio.bpdMm > 0 ? bio.bpdMm : undefined,
          hcMm: bio.hcMm > 0 ? bio.hcMm : undefined,
          acMm: bio.acMm > 0 ? bio.acMm : undefined,
          flMm: bio.flMm > 0 ? bio.flMm : undefined,
        });
      }

      // Mostra solo lo storico fino a questa visita: punti con GA <= visita corrente (nessun punto "futuro")
      if (ga != null && pts.length > 0) {
        const gaMax = ga + 0.5; // tolleranza stessa settimana
        pts = pts.filter((p) => p.gaWeeks <= gaMax).sort((a, b) => a.gaWeeks - b.gaWeeks);
      }

      if (pts.length > 0) {
        y = this.drawBiometricCharts(doc, pts, y);
      }
    }

    // ── IMMAGINI ECOGRAFIA (ultima sezione) ───────────────────────────────────
    if (options?.includeEcografiaImages) y = await this.drawImages(doc, obs.ecografiaImmagini, y);

    try { this.drawFooter(doc, doctor, fo); return doc.output("blob") as Blob; }
    finally { this.fCtx = null; }
  }

  // ─── RICHIESTA ESAME ──────────────────────────────────────────────────────
  static async generateRichiestaEsamePDF(
    patient: Patient, richiesta: RichiestaEsameComplementare, doctor: Doctor | null
  ): Promise<Blob> {
    const doc = new jsPDF();
    let y = this.drawHeader(doc, "RICHIESTA ESAME COMPLEMENTARE", "Prescrizione esame", doctor, false);
    y = this.drawPatientBlock(doc, patient, richiesta.dataRichiesta, y);
    y += 4;
    y = this.heading(doc, y, "Esame richiesto");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); this.tc(doc, K0);
    y = this.block(doc, richiesta.nome, ML + 1, y, PW - 2, undefined, {
      font: "helvetica", style: "bold", fontSize: 10, color: K0,
    });
    if (richiesta.note?.trim()) {
      y += 2; doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); this.tc(doc, K30);
      y = this.block(doc, richiesta.note, ML + 1, y, PW - 2, undefined, {
        font: "helvetica", style: "normal", fontSize: 9.5, color: K30,
      });
    }
    y += 4; doc.setFont("helvetica", "normal"); doc.setFontSize(8); this.tc(doc, K140);
    doc.text("Data richiesta: " + fd(richiesta.dataRichiesta), ML + 1, y);
    const prefs = await PreferenceService.getPreferences();
    this.drawFooter(doc, doctor, {
      showDoctorPhoneInPdf: prefs?.showDoctorPhoneInPdf as boolean | undefined,
      showDoctorEmailInPdf: prefs?.showDoctorEmailInPdf as boolean | undefined,
    });
    return doc.output("blob") as Blob;
  }

  // ─── CERTIFICATO ──────────────────────────────────────────────────────────
  static async generateCertificatoPDF(
    patient: Patient, certificato: CertificatoPaziente, doctor: Doctor | null
  ): Promise<Blob> {
    const doc = new jsPDF();
    const tipoL: Record<CertificatoPaziente["tipo"], string> = {
      assenza_lavoro: "Assenza da lavoro", idoneita: "Idoneita'", malattia: "Malattia", altro: "Altro",
    };
    let y = this.drawHeader(doc, "CERTIFICATO MEDICO", tipoL[certificato.tipo] || certificato.tipo, doctor, false);
    y = this.drawPatientBlock(doc, patient, certificato.dataCertificato, y, "Data certificato");
    y += 4;
    y = this.heading(doc, y, "Testo del Certificato");
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); this.tc(doc, K30);
    y = this.block(doc, certificato.descrizione || "", ML + 1, y, PW - 2, undefined, {
      font: "helvetica", style: "normal", fontSize: 10, color: K30,
    });
    const prefs = await PreferenceService.getPreferences();
    this.drawFooter(doc, doctor, {
      showDoctorPhoneInPdf: prefs?.showDoctorPhoneInPdf as boolean | undefined,
      showDoctorEmailInPdf: prefs?.showDoctorEmailInPdf as boolean | undefined,
    });
    return doc.output("blob") as Blob;
  }
}