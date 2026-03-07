import jsPDF from "jspdf";
import {
  Patient,
  Visit,
  Doctor,
  RichiestaEsameComplementare,
  CertificatoPaziente,
} from "../types/Storage";
import { DoctorService, PreferenceService } from "./OfflineServices";
import { calcolaStimePesoFetale } from "../utils/fetalWeightUtils";
import {
  parseGestationalWeeks,
  getCentileForWeight,
  getCentileLabel,
  getCentileCurveData,
  FETAL_GROWTH_WEEK_RANGE,
} from "../utils/fetalGrowthCentiles";

// ─── Layout Constants ───────────────────────────────────────────────────────
const MARGIN_L = 15;
const MARGIN_R = 195;
const PAGE_W = MARGIN_R - MARGIN_L;
const LINE_H = 5; // Compact line height
const SECTION_GAP = 5; // Minimal gap between sections

// Colors - Elegant Monochrome
const PRIMARY_COLOR = [20, 20, 20]; // Almost Black
const SECONDARY_COLOR = [60, 60, 60]; // Dark Gray
const ACCENT_COLOR = [240, 240, 240]; // Very Light Gray
const BORDER_COLOR = [200, 200, 200]; // Light Gray

export interface FetalGrowthPoint {
  gaWeeks: number;
  pesoGrammi: number;
}

interface VisitPdfOptions {
  includeEcografiaImages?: boolean;
  includeFetalGrowthChart?: boolean;
  /** Punti (GA, peso) da disegnare: visita corrente + eventuali visite precedenti. Se assente, si usa solo il punto della visita corrente. */
  fetalGrowthDataPoints?: FetalGrowthPoint[];
}

interface FooterVisibilityOptions {
  showDoctorPhoneInPdf?: boolean;
  showDoctorEmailInPdf?: boolean;
}

export class PdfService {
  /** Contesto per disegnare il footer su ogni pagina prima di un page break (impostato dalle generate*PDF). */
  private static footerContext: {
    doctor: Doctor | null;
    options: FooterVisibilityOptions;
  } | null = null;

  // ─── Text Sanitization ──────────────────────────────────────────────────
  private static sanitizeText(text: string): string {
    if (!text) return "";
    let result = "";
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      switch (code) {
        case 224:
          result += "a'";
          break;
        case 232:
          result += "e'";
          break;
        case 233:
          result += "e'";
          break;
        case 236:
          result += "i'";
          break;
        case 242:
          result += "o'";
          break;
        case 249:
          result += "u'";
          break;
        case 192:
          result += "A'";
          break;
        case 200:
          result += "E'";
          break;
        case 201:
          result += "E'";
          break;
        case 204:
          result += "I'";
          break;
        case 210:
          result += "O'";
          break;
        case 217:
          result += "U'";
          break;
        case 195: {
          const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
          if (next === 160) {
            result += "a'";
            i++;
            break;
          }
          if (next === 168) {
            result += "e'";
            i++;
            break;
          }
          if (next === 169) {
            result += "e'";
            i++;
            break;
          }
          if (next === 172) {
            result += "i'";
            i++;
            break;
          }
          if (next === 178) {
            result += "o'";
            i++;
            break;
          }
          if (next === 185) {
            result += "u'";
            i++;
            break;
          }
          result += text[i];
          break;
        }
        default:
          result += text[i];
          break;
      }
    }
    return result;
  }

  private static s(text: string): string {
    return this.sanitizeText(text);
  }

  // ─── Utility Helpers ────────────────────────────────────────────────────
  private static formatDate(dateString: string): string {
    if (!dateString) return "N/D";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "N/D";
    return d.toLocaleDateString("it-IT");
  }

  private static calculateAge(birthDateString: string): string {
    if (!birthDateString) return "";
    const birthDate = new Date(birthDateString);
    if (isNaN(birthDate.getTime())) return "";
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age.toString();
  }

  private static val(
    v: string | number | undefined | null,
    fallback = "-",
  ): string {
    if (v === undefined || v === null || v === "") return fallback;
    return String(v);
  }

  // ─── Drawing Primitives ─────────────────────────────────────────────────

  /** Draws a horizontal rule across the page */
  private static hr(doc: jsPDF, y: number, color = BORDER_COLOR) {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(0.1);
    doc.line(MARGIN_L, y, MARGIN_R, y);
  }

  /** Page break check — returns new Y or same Y. Se c'è footerContext, disegna il footer sulla pagina corrente prima di aggiungere la nuova. */
  private static pageBreak(doc: jsPDF, y: number, needed = 40): number {
    if (y + needed > 275) {
      if (PdfService.footerContext) {
        this.drawFooter(doc, PdfService.footerContext.doctor, PdfService.footerContext.options);
      }
      doc.addPage();
      return 20; // Start higher on new page
    }
    return y;
  }

  // ─── Header ─────────────────────────────────────────────────────────────
  private static drawHeader(
    doc: jsPDF,
    title: string,
    subtitle: string,
    doctor: Doctor | null,
    showDoctorInfo = true,
  ): number {
    let y = 15; // Start higher

    if (showDoctorInfo) {
      // 1. Doctor Name - Centered, Large
      const doctorName = doctor
        ? `Dott. ${doctor.nome} ${doctor.cognome}`
        : "Studio Medico";
      doc.setFont("times", "bold");
      doc.setFontSize(16);
      doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.text(this.s(doctorName.toUpperCase()), 105, y, { align: "center" });

      y += 5;

      // 2. Specialization - Centered
      if (doctor?.specializzazione) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(
          SECONDARY_COLOR[0],
          SECONDARY_COLOR[1],
          SECONDARY_COLOR[2],
        );
        doc.text(this.s(doctor.specializzazione.toUpperCase()), 105, y, {
          align: "center",
        });
        y += 6;
      } else {
        y += 2;
      }
    }

    // 3. Separator Line
    doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_L + 30, y, MARGIN_R - 30, y);
    y += 8;

    // 4. Document Title - Large, Centered
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18); // Slightly smaller
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.text(this.s(title), 105, y, { align: "center" });
    y += 6;

    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(
        SECONDARY_COLOR[0],
        SECONDARY_COLOR[1],
        SECONDARY_COLOR[2],
      );
      doc.text(this.s(subtitle), 105, y, { align: "center" });
      y += 8;
    } else {
      y += 4;
    }

    return y;
  }

  // ─── Patient Info Box ───────────────────────────────────────────────────
  private static drawPatientBox(
    doc: jsPDF,
    patient: Patient,
    visitDate: string,
    y: number,
    dateLabel = "DATA VISITA",
  ): number {
    // Enclosed Box with light background header - COMPACT

    const boxHeight = 22; // Reduced height
    const boxY = y;

    // Background for header
    doc.setFillColor(ACCENT_COLOR[0], ACCENT_COLOR[1], ACCENT_COLOR[2]);
    doc.rect(MARGIN_L, boxY, PAGE_W, 6, "F");

    // Border
    doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
    doc.setLineWidth(0.2);
    doc.rect(MARGIN_L, boxY, PAGE_W, boxHeight);

    // Labels
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(
      SECONDARY_COLOR[0],
      SECONDARY_COLOR[1],
      SECONDARY_COLOR[2],
    );
    doc.text("DATI DEL PAZIENTE", MARGIN_L + 4, boxY + 4);
    doc.text(
      dateLabel + ": " + this.formatDate(visitDate),
      MARGIN_R - 4,
      boxY + 4,
      { align: "right" },
    );

    // Content
    const contentY = boxY + 12;

    // Name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.text(
      this.s(`${patient.nome} ${patient.cognome}`),
      MARGIN_L + 4,
      contentY,
    );

    // Details
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(
      SECONDARY_COLOR[0],
      SECONDARY_COLOR[1],
      SECONDARY_COLOR[2],
    );

    const age = this.calculateAge(patient.dataNascita);
    const detailsParts: string[] = [];
    if (patient.dataNascita) {
      detailsParts.push(
        `Nato/a il: ${this.formatDate(patient.dataNascita)} ${age ? `(${age} anni)` : ""}`,
      );
    }
    if (patient.codiceFiscale?.trim()) {
      detailsParts.push(`CF: ${patient.codiceFiscale}`);
    }
    if (patient.sesso) {
      detailsParts.push(`Sesso: ${patient.sesso}`);
    }
    const details = detailsParts.join("   •   ");
    if (details) {
      doc.text(this.s(details), MARGIN_L + 4, contentY + 5);
    }

    return boxY + boxHeight + 8; // Reduced spacing after box
  }

  // ─── Section Drawing ────────────────────────────────────────────────────
  /** Disegna il contenuto riga per riga con page break per non oltrepassare il piede di pagina. */
  private static drawSection(
    doc: jsPDF,
    title: string,
    content: string | undefined | null,
    y: number,
    note?: string,
  ): number {
    if (!content || content.trim() === "") return y;

    y = this.pageBreak(doc, y, 20); // Less aggressive break

    // Section Title Bar - COMPACT
    doc.setFillColor(ACCENT_COLOR[0], ACCENT_COLOR[1], ACCENT_COLOR[2]);
    doc.rect(MARGIN_L, y, PAGE_W, 5, "F");

    // Title Text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.text(this.s(title.toUpperCase()), MARGIN_L + 4, y + 3.5);

    y += 8; // Closer content

    // Content: riga per riga con page break così il testo non supera il piede di pagina.
    // Dopo ogni pageBreak drawFooter imposta font 7: ripristiniamo font/contenuto prima di ogni riga.
    const sanitized = this.s(content);
    const lines = doc.splitTextToSize(sanitized, PAGE_W - 4);
    for (const line of lines) {
      y = this.pageBreak(doc, y, LINE_H);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.text(line, MARGIN_L + 2, y);
      y += LINE_H;
    }

    // Optional Note (Disclaimer) — anche la nota con page break; ripristinare stile nota dopo ogni break.
    const NOTE_LINE_H = 3;
    if (note) {
      y = this.pageBreak(doc, y, NOTE_LINE_H + 2);
      y += 2;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(
        SECONDARY_COLOR[0],
        SECONDARY_COLOR[1],
        SECONDARY_COLOR[2],
      );
      const noteLines = doc.splitTextToSize(note, PAGE_W - 4);
      for (const line of noteLines) {
        y = this.pageBreak(doc, y, NOTE_LINE_H);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(
          SECONDARY_COLOR[0],
          SECONDARY_COLOR[1],
          SECONDARY_COLOR[2],
        );
        doc.text(line, MARGIN_L + 2, y);
        y += NOTE_LINE_H;
      }
    }

    return y + SECTION_GAP;
  }

  /** Esclude campi con valore vuoto o "-" (per non mostrarli in PDF). */
  private static filterGridItems(
    items: { label: string; value: string }[],
  ): { label: string; value: string }[] {
    return items.filter((item) => {
      const v = item.value;
      return v != null && String(v).trim() !== "" && v !== "-";
    });
  }

  /** Draw a simple key-value row enclosed in lines - COMPACT. Ometti i campi con valore vuoto o "-". */
  private static drawGridRow(
    doc: jsPDF,
    items: { label: string; value: string }[],
    y: number,
  ): number {
    const filtered = this.filterGridItems(items);
    if (filtered.length === 0) return y;

    const rowHeight = 10; // Reduced height
    const colWidth = PAGE_W / filtered.length;

    // Top line
    doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
    doc.setLineWidth(0.1);
    doc.line(MARGIN_L, y, MARGIN_R, y);

    filtered.forEach((item, i) => {
      const x = MARGIN_L + colWidth * i;

      // Label
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(
        SECONDARY_COLOR[0],
        SECONDARY_COLOR[1],
        SECONDARY_COLOR[2],
      );
      doc.text(this.s(item.label), x + colWidth / 2, y + 3.5, {
        align: "center",
      });

      // Value
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.text(this.s(this.val(item.value)), x + colWidth / 2, y + 7.5, {
        align: "center",
      });

      // Vertical divider (except last)
      if (i < filtered.length - 1) {
        doc.line(x + colWidth, y, x + colWidth, y + rowHeight);
      }
    });

    // Bottom line
    doc.line(MARGIN_L, y + rowHeight, MARGIN_R, y + rowHeight);

    return y + rowHeight + 6; // Reduced spacing after
  }

  /**
   * Converte un data URL (qualsiasi formato immagine) in JPEG via canvas.
   * Necessario per ecografie/PNG con trasparenza che jsPDF non gestisce bene (rettangoli bianchi).
   */
  private static dataUrlToJpegDataUrl(dataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("No canvas context"));
            return;
          }
          // Sfondo bianco per aree trasparenti (es. ecografie)
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          const jpeg = canvas.toDataURL("image/jpeg", 0.92);
          resolve(jpeg);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = dataUrl;
    });
  }

  /** Draw image gallery section for ecografia attachments */
  private static async drawEcografiaImages(
    doc: jsPDF,
    images: string[] | undefined,
    y: number,
  ): Promise<number> {
    if (!images || images.length === 0) return y;

    y = this.pageBreak(doc, y, 30);
    doc.setFillColor(ACCENT_COLOR[0], ACCENT_COLOR[1], ACCENT_COLOR[2]);
    doc.rect(MARGIN_L, y, PAGE_W, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.text("IMMAGINI ECOGRAFIA", MARGIN_L + 4, y + 3.5);
    y += 8;

    const gap = 4;
    const columns = 2;
    const tileWidth = (PAGE_W - gap) / columns;
    const tileHeight = 58;

    for (let i = 0; i < images.length; i += columns) {
      y = this.pageBreak(doc, y, tileHeight + 10);
      const row = images.slice(i, i + columns);
      const converted = await Promise.all(
        row.map((img) =>
          this.dataUrlToJpegDataUrl(img).catch(() => null),
        ),
      );
      converted.forEach((image, col) => {
        const x = MARGIN_L + col * (tileWidth + gap);
        doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
        doc.setLineWidth(0.2);
        doc.rect(x, y, tileWidth, tileHeight);
        if (image) {
          try {
            const props = (doc as any).getImageProperties(image);
            const ratio = props.width / props.height;
            let w = tileWidth - 2;
            let h = w / ratio;
            if (h > tileHeight - 2) {
              h = tileHeight - 2;
              w = h * ratio;
            }
            const ox = x + (tileWidth - w) / 2;
            const oy = y + (tileHeight - h) / 2;
            doc.addImage(image, "JPEG", ox, oy, w, h);
          } catch {
            this.drawPlaceholderText(doc, x, tileWidth, y, tileHeight);
          }
        } else {
          this.drawPlaceholderText(doc, x, tileWidth, y, tileHeight);
        }
      });
      y += tileHeight + 5;
    }

    return y + SECTION_GAP;
  }

  private static drawPlaceholderText(
    doc: jsPDF,
    x: number,
    tileWidth: number,
    y: number,
    tileHeight: number,
  ): void {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(
      SECONDARY_COLOR[0],
      SECONDARY_COLOR[1],
      SECONDARY_COLOR[2],
    );
    doc.text(
      "Immagine non disponibile",
      x + tileWidth / 2,
      y + tileHeight / 2,
      { align: "center" },
    );
  }

  /** Grafico crescita fetale (centili): assi con tick, griglia, curve etichettate, traiettoria, legenda. Ottimizzato per A4 e B/N. */
  private static drawFetalGrowthChart(
    doc: jsPDF,
    points: FetalGrowthPoint[],
    startY: number,
  ): number {
    const chartLeft = MARGIN_L + 20;
    const chartW = PAGE_W - 26;
    const chartH = 46;
    const titleGap = 6; // spazio tra sottotitolo e bordo superiore del grafico
    const chartTop = startY + 8 + titleGap; // titolo + sottotitolo + gap
    const chartBottom = chartTop + chartH;
    const weekMin = FETAL_GROWTH_WEEK_RANGE.min;
    const weekMax = FETAL_GROWTH_WEEK_RANGE.max;
    const weightMax = 6000;
    const gridGray = 230;
    const axisGray = 80;

    const toX = (week: number) =>
      chartLeft + ((week - weekMin) / (weekMax - weekMin)) * chartW;
    const toY = (weight: number) =>
      chartBottom - (weight / weightMax) * chartH;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.text("Crescita fetale – Peso stimato (EFW) vs Età gestazionale", MARGIN_L, startY + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
    doc.text("Curve di riferimento: Hadlock (EFW) | Peso in grammi", MARGIN_L, startY + 8);

    doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
    doc.setLineWidth(0.25);
    doc.rect(chartLeft, chartTop, chartW, chartH);

    // Griglia: verticale ogni 2 settimane, orizzontale ogni 1000 g
    doc.setDrawColor(gridGray, gridGray, gridGray);
    doc.setLineWidth(0.1);
    for (let w = weekMin; w <= weekMax; w += 2) {
      const x = toX(w);
      doc.line(x, chartTop, x, chartBottom);
    }
    for (let g = 0; g <= weightMax; g += 1000) {
      const y = toY(g);
      doc.line(chartLeft, y, chartLeft + chartW, y);
    }

    // Assi e tick con etichette
    doc.setDrawColor(axisGray, axisGray, axisGray);
    doc.setLineWidth(0.2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(axisGray, axisGray, axisGray);
    for (let w = weekMin; w <= weekMax; w += 2) {
      const x = toX(w);
      doc.line(x, chartBottom, x, chartBottom + 2);
      doc.text(String(w), x - 2, chartBottom + 5, { align: "center" });
    }
    doc.text("Età gestazionale (settimane)", chartLeft + chartW / 2 - 18, chartBottom + 10);
    for (let g = 0; g <= weightMax; g += 1000) {
      const y = toY(g);
      doc.line(chartLeft - 2, y, chartLeft, y);
      doc.text(String(g), chartLeft - 4, y + 1.2, { align: "right" });
    }
    doc.text("Peso fetale stimato (g)", MARGIN_L, chartTop + chartH / 2, { angle: 90 });

    // Curve centili con toni di grigio diversi (P50 più marcata) ed etichette P5, P10, … P95
    const curves = getCentileCurveData();
    const centileGray: Record<number, number> = {
      5: 170, 10: 150, 25: 120, 50: 50, 75: 120, 90: 150, 95: 170,
    };
    curves.forEach(({ centile, points: curvePts }) => {
      const gray = centileGray[centile] ?? 120;
      doc.setDrawColor(gray, gray, gray);
      doc.setLineWidth(centile === 50 ? 0.4 : 0.22);
      for (let i = 0; i < curvePts.length - 1; i++) {
        const a = curvePts[i];
        const b = curvePts[i + 1];
        doc.line(toX(a.week), toY(a.weight), toX(b.week), toY(b.weight));
      }
      const last = curvePts[curvePts.length - 1];
      doc.setFontSize(5.5);
      doc.setTextColor(gray, gray, gray);
      doc.text(`P${centile}`, toX(41.2), toY(last.weight) - 0.8);
    });

    // Ordina punti per GA e traccia linea di traiettoria
    const sortedPoints = [...points].sort((a, b) => a.gaWeeks - b.gaWeeks);
    const inRange = (p: FetalGrowthPoint) =>
      p.gaWeeks >= weekMin &&
      p.gaWeeks <= weekMax &&
      p.pesoGrammi > 0 &&
      p.pesoGrammi <= weightMax;
    const validPoints = sortedPoints.filter(inRange);
    if (validPoints.length >= 2) {
      doc.setDrawColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.setLineWidth(0.35);
      for (let i = 0; i < validPoints.length - 1; i++) {
        const a = validPoints[i];
        const b = validPoints[i + 1];
        doc.line(toX(a.gaWeeks), toY(a.pesoGrammi), toX(b.gaWeeks), toY(b.pesoGrammi));
      }
    }

    // Punti: precedenti piccoli grigi, corrente più grande con bordo (leggibile in B/N)
    validPoints.forEach((p, i) => {
      const cx = toX(p.gaWeeks);
      const cy = toY(p.pesoGrammi);
      const isLast = i === validPoints.length - 1;
      if (isLast) {
        doc.setDrawColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
        doc.setFillColor(255, 255, 255);
        doc.setLineWidth(0.45);
        doc.circle(cx, cy, 2.2, "FD");
        doc.circle(cx, cy, 2.2, "S");
      } else {
        doc.setDrawColor(100, 100, 100);
        doc.setFillColor(100, 100, 100);
        doc.setLineWidth(0.2);
        doc.circle(cx, cy, 1, "FD");
      }
    });

    // Legenda e valore corrente
    const legendY = chartBottom + 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
    doc.text("Precedenti (punti)  —  Traiettoria (linea)  —  Visita corrente (evidenziato)", chartLeft, legendY);
    const lastPoint = validPoints[validPoints.length - 1];
    if (lastPoint) {
      const centile = getCentileForWeight(lastPoint.pesoGrammi, lastPoint.gaWeeks);
      const centileStr = getCentileLabel(centile);
      const gaLabel = `${Math.floor(lastPoint.gaWeeks)}+${Math.round((lastPoint.gaWeeks % 1) * 7)}`;
      const valueText = centileStr
        ? `EFW ${lastPoint.pesoGrammi} g – ${gaLabel} sett – ${centileStr} centile`
        : `EFW ${lastPoint.pesoGrammi} g – ${gaLabel} sett`;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
      doc.text(valueText, chartLeft + chartW - 2, legendY, { align: "right" });
      if (centile != null && (centile < 10 || centile > 90)) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.5);
        doc.text("(valore al di fuori del range di normalità)", chartLeft + chartW - 2, legendY + 3.5, { align: "right" });
      }
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5);
    doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
    doc.text("EFW: stima ecografica. Le curve sono indicative e non sostituiscono il giudizio clinico.", MARGIN_L, legendY + 8);

    return legendY + 12;
  }

  // ─── Footer ─────────────────────────────────────────────────────────────
  private static drawFooter(doc: jsPDF, doctor: Doctor | null, visibility?: FooterVisibilityOptions) {
    const pageH = doc.internal.pageSize.height;
    const footerY = pageH - 15;

    doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
    doc.setLineWidth(0.1);
    doc.line(MARGIN_L + 20, footerY, MARGIN_R - 20, footerY);

    doc.setFontSize(7);
    doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);

    const footerTextParts: string[] = [];
    if (doctor?.ambulatori && doctor.ambulatori.length > 0) {
      const amb = doctor.ambulatori.find((a) => a.isPrimario) || doctor.ambulatori[0];
      footerTextParts.push(`${amb.nome}`);
      footerTextParts.push(`${amb.indirizzo}, ${amb.citta}`);
    }
    const showPhone = visibility?.showDoctorPhoneInPdf !== false;
    const showEmail = visibility?.showDoctorEmailInPdf !== false;
    if (showPhone && doctor?.telefono) footerTextParts.push(`Tel: ${doctor.telefono}`);
    if (showEmail && doctor?.email) footerTextParts.push(`${doctor.email}`);

    const footerText = footerTextParts.join("  •  ");
    doc.text(this.s(footerText), 105, footerY + 6, { align: "center" });
  }

  // ─── Normalizzazione visite “piatte” (es. da import CSV) ─────────────────
  private static buildGinecologiaFromFlat(visit: Visit): NonNullable<Visit["ginecologia"]> {
    const a = visit.anamnesi ?? "";
    const e = visit.esamiObiettivo ?? "";
    const c = visit.conclusioniDiagnostiche ?? "";
    const t = visit.terapie ?? "";
    const terapiaSpecifica = [c, t].filter(Boolean).join("\n");
    return {
      gravidanze: 0,
      parti: 0,
      aborti: 0,
      ultimaMestruazione: "",
      prestazione: a,
      problemaClinico: visit.descrizioneClinica ?? "",
      chirurgiaPregessa: "",
      allergie: "",
      familiarita: "",
      terapiaInAtto: "",
      vaccinazioneHPV: true,
      esameBimanuale: e,
      speculum: "",
      ecografiaTV: "",
      accertamenti: "",
      conclusione: c,
      terapiaSpecifica,
      ecografiaImmagini: [],
    };
  }

  /** Costruisce un oggetto ostetricia minimo dai campi piatti della visita. */
  private static buildOstetriciaFromFlat(visit: Visit): NonNullable<Visit["ostetricia"]> {
    const a = visit.anamnesi ?? "";
    const e = visit.esamiObiettivo ?? "";
    const conclusioneTerapie = [visit.conclusioniDiagnostiche, visit.terapie].filter(Boolean).join("\n");
    return {
      settimaneGestazione: "",
      ultimaMestruazione: "",
      dataPresunta: "",
      modalitaConcepimento: "",
      problemaClinico: visit.descrizioneClinica ?? "",
      gravidanzePrec: 0,
      partiPrec: 0,
      abortiPrec: 0,
      pesoPreGravidanza: 0,
      pesoAttuale: 0,
      pressioneArteriosa: "",
      fumaInGravidanza: "",
      pacchettiSigaretteAlGiorno: 0,
      assunzioneAcidoFolico: "",
      altezzaUterina: "",
      battitiFetali: "",
      movimentiFetali: "",
      esamiEseguiti: "",
      ecografiaOffice: e,
      noteOstetriche: conclusioneTerapie,
      prestazione: a,
      esameObiettivo: e,
      ecografiaImmagini: [],
      biometriaFetale: { bpdMm: 0, hcMm: 0, acMm: 0, flMm: 0 },
    };
  }

  /** Restituisce la visita con ginecologia/ostetricia compilati da flat se mancanti (es. visite da CSV). */
  private static normalizeVisitForPdf(visit: Visit): Visit {
    const isGyn =
      visit.tipo === "ginecologica" || visit.tipo === "ginecologica_pediatrica";
    const isObs = visit.tipo === "ostetrica";
    const ginecologia =
      visit.ginecologia ?? (isGyn ? this.buildGinecologiaFromFlat(visit) : undefined);
    const ostetricia =
      visit.ostetricia ?? (isObs ? this.buildOstetriciaFromFlat(visit) : undefined);
    if (ginecologia || ostetricia) {
      return { ...visit, ginecologia, ostetricia };
    }
    return visit;
  }

  //  PUBLIC METHODS
  // ═══════════════════════════════════════════════════════════════════════

  static async generateGynecologicalPDF(
    patient: Patient,
    visit: Visit,
    options?: VisitPdfOptions,
  ) {
    const normalized = this.normalizeVisitForPdf(visit);
    if (!normalized.ginecologia) return;

    const gyn = normalized.ginecologia;
    const isPediatric = visit.tipo === "ginecologica_pediatrica";
    const [doctor, prefs] = await Promise.all([
      DoctorService.getDoctor(),
      PreferenceService.getPreferences(),
    ]);
    const footerOpts: FooterVisibilityOptions = {
      showDoctorPhoneInPdf: prefs?.showDoctorPhoneInPdf as boolean | undefined,
      showDoctorEmailInPdf: prefs?.showDoctorEmailInPdf as boolean | undefined,
    };
    PdfService.footerContext = { doctor, options: footerOpts };
    const doc = new jsPDF();

    let y = this.drawHeader(
      doc,
      isPediatric ? "VISITA GINECOLOGICA PEDIATRICA" : "VISITA GINECOLOGICA",
      "Referto Specialistico",
      doctor,
    );
    y = this.drawPatientBox(doc, patient, visit.dataVisita, y);

    // ── Anamnesi Grid ──
    if (isPediatric) {
      y = this.drawGridRow(
        doc,
        [
          { label: "MENARCA", value: gyn.menarca ?? "-" },
          {
            label: "VACCINAZIONE HPV",
            value: gyn.vaccinazioneHPV ? "SI" : "NO",
          },
          {
            label: "STADIO DI TANNER (F)",
            value: gyn.stadioTannerFemmina ?? "-",
          },
        ],
        y,
      );
    } else {
      const partiValue =
        gyn.partiSpontanei != null || gyn.partiCesarei != null
          ? `${gyn.parti} (${gyn.partiSpontanei ?? 0} PS, ${gyn.partiCesarei ?? 0} TC)`
          : String(gyn.parti);
      const abortiValue =
        gyn.abortiSpontanei != null || gyn.ivg != null
          ? `${gyn.aborti} (${gyn.abortiSpontanei ?? 0} AS, ${gyn.ivg ?? 0} IVG)`
          : String(gyn.aborti);
      const anamnesiGridItems: { label: string; value: string }[] = [
        { label: "GRAVIDANZE (G)", value: String(gyn.gravidanze) },
        { label: "PARTI (P)", value: partiValue },
        { label: "ABORTI (A)", value: abortiValue },
      ];
      if (gyn.ultimaMestruazione?.trim()) {
        anamnesiGridItems.push({
          label: "ULTIMA MESTRUAZIONE",
          value: this.formatDate(gyn.ultimaMestruazione),
        });
      }
      y = this.drawGridRow(doc, anamnesiGridItems, y);
    }

    const SIEOG_NOTE =
      "Ecografia Office di supporto alla visita clinica. Non sostituisce le ecografie di screening previste dalle Linee Guida SIEOG, e di ciò si informa la persona assistita.";
    y = this.drawSection(doc, "ANAMNESI", gyn.prestazione, y);
    y = this.drawSection(doc, "Anamnesi e Dati Clinici", gyn.problemaClinico, y);
    y = this.drawSection(doc, "ECOGRAFIA OFFICE / ESAME OBIETTIVO", gyn.esameBimanuale, y, SIEOG_NOTE);
    if (options?.includeEcografiaImages) {
      y = await this.drawEcografiaImages(doc, gyn.ecografiaImmagini, y);
    }
    y = this.drawSection(doc, "Conclusioni e Terapia", gyn.terapiaSpecifica, y);
    try {
      this.drawFooter(doc, doctor, footerOpts);
      return doc.output("blob") as Blob;
    } finally {
      PdfService.footerContext = null;
    }
  }

  static async generateObstetricPDF(
    patient: Patient,
    visit: Visit,
    options?: VisitPdfOptions,
  ) {
    const normalized = this.normalizeVisitForPdf(visit);
    if (!normalized.ostetricia) return;
    const obs = normalized.ostetricia;
    const [doctor, prefs] = await Promise.all([
      DoctorService.getDoctor(),
      PreferenceService.getPreferences(),
    ]);
    const footerOpts: FooterVisibilityOptions = {
      showDoctorPhoneInPdf: prefs?.showDoctorPhoneInPdf as boolean | undefined,
      showDoctorEmailInPdf: prefs?.showDoctorEmailInPdf as boolean | undefined,
    };
    PdfService.footerContext = { doctor, options: footerOpts };
    const formulaPesoFetale =
      (prefs?.formulaPesoFetale as string) || "hadlock4";
    const doc = new jsPDF();

    let y = this.drawHeader(
      doc,
      "VISITA OSTETRICA",
      "Monitoraggio della Gravidanza",
      doctor,
    );
    y = this.drawPatientBox(doc, patient, visit.dataVisita, y);

    // ── Anamnesi Ostetrica Grid ──
    const partiPrecValue =
      obs.partiPrecSpontanei != null || obs.partiPrecCesarei != null
        ? `${obs.partiPrec} (${obs.partiPrecSpontanei ?? 0} PS, ${obs.partiPrecCesarei ?? 0} TC)`
        : String(obs.partiPrec);
    const abortiPrecValue =
      obs.abortiPrecSpontanei != null || obs.ivgPrec != null
        ? `${obs.abortiPrec} (${obs.abortiPrecSpontanei ?? 0} AS, ${obs.ivgPrec ?? 0} IVG)`
        : String(obs.abortiPrec);
    const modalitaConcepimentoLabels: Record<string, string> = {
      spontaneo: "Spontaneo",
      fivet: "FIVET",
      icsi: "ICSI",
      iui: "IUI/Inseminazione",
      donazione_ovociti: "Donazione ovociti",
      altra: "Altra",
    };
    const modalitaConcepimentoValue = obs.modalitaConcepimento
      ? modalitaConcepimentoLabels[obs.modalitaConcepimento] ?? obs.modalitaConcepimento
      : "-";
    y = this.drawGridRow(
      doc,
      [
        { label: "GRAVIDANZE PREC.", value: String(obs.gravidanzePrec) },
        { label: "PARTI PREC.", value: partiPrecValue },
        { label: "ABORTI PREC.", value: abortiPrecValue },
        {
          label: "ULTIMA MESTRUAZIONE",
          value: this.formatDate(obs.ultimaMestruazione),
        },
        { label: "MODALITÀ CONCEP.", value: modalitaConcepimentoValue },
      ],
      y,
    );

    // ── Pregnancy Parameters Grid (con Peso fetale stimato) ──
    const biometria = obs.biometriaFetale ?? {
      bpdMm: 0,
      hcMm: 0,
      acMm: 0,
      flMm: 0,
    };
    const stimePeso = calcolaStimePesoFetale(biometria);
    const stima = stimePeso[formulaPesoFetale] ?? stimePeso.hadlock4;
    let pesoFetaleValue = "-";
    if (stima?.calcolabile && stima.pesoGrammi != null) {
      const ga = parseGestationalWeeks(obs.settimaneGestazione ?? "");
      const centile =
        ga != null ? getCentileForWeight(stima.pesoGrammi, ga) : null;
      const centileStr = getCentileLabel(centile);
      pesoFetaleValue = centileStr
        ? `${stima.pesoGrammi} g (${centileStr} centile)`
        : `${stima.pesoGrammi} g`;
    }

    const hasAltezza =
      patient?.altezza != null && patient.altezza > 0;
    const bmiPartenzaValue =
      hasAltezza &&
      obs.pesoPreGravidanza != null &&
      Number(obs.pesoPreGravidanza) > 0
        ? (Number(obs.pesoPreGravidanza) / Math.pow(patient!.altezza / 100, 2)).toFixed(1)
        : "-";
    const bmiValue =
      hasAltezza &&
      obs.pesoAttuale != null &&
      Number(obs.pesoAttuale) > 0
        ? (Number(obs.pesoAttuale) / Math.pow(patient!.altezza / 100, 2)).toFixed(1)
        : "-";

    const fumaLabels: Record<string, string> = {
      no: "No",
      meno_1: "<1 pacc./gg",
      "1": "1 pacc./gg",
      "2": "2 pacc./gg",
      "3": "3 pacc./gg",
      "4": "4 pacc./gg",
      "5_plus": "5+ pacc./gg",
    };
    const fumaValue = obs.fumaInGravidanza
      ? fumaLabels[obs.fumaInGravidanza] ?? obs.fumaInGravidanza
      : "-";
    // Retrocompatibilità: se salvato con vecchio formato "si" + pacchettiSigaretteAlGiorno
    const fumaDisplay =
      fumaValue !== "-"
        ? fumaValue
        : obs.pacchettiSigaretteAlGiorno != null &&
            Number(obs.pacchettiSigaretteAlGiorno) > 0
          ? `${obs.pacchettiSigaretteAlGiorno} pacc./gg`
          : "-";

    const acidoFolicoValue = obs.assunzioneAcidoFolico === "si" ? "Sì" : obs.assunzioneAcidoFolico === "no" ? "No" : "-";

    const parametriItems = [
      { label: "SETT. GESTAZIONE", value: obs.settimaneGestazione ?? "" },
      { label: "DATA PRESUNTA", value: this.formatDate(obs.dataPresunta) },
      { label: "PRESSIONE", value: obs.pressioneArteriosa ?? "" },
      {
        label: "PESO ATTUALE",
        value: obs.pesoAttuale ? `${obs.pesoAttuale} kg` : "-",
      },
      {
        label: "INCREM. PONDERALE",
        value:
          obs.pesoAttuale && obs.pesoPreGravidanza
            ? `${(Number(obs.pesoAttuale) - Number(obs.pesoPreGravidanza)).toFixed(1)} kg`
            : "-",
      },
      { label: "BMI PARTENZA", value: bmiPartenzaValue },
      { label: "BMI", value: bmiValue },
      { label: "FUMA (pacc./gg)", value: fumaDisplay },
      { label: "ACIDO FOLICO", value: acidoFolicoValue },
      { label: "PESO FETALE STIMATO", value: pesoFetaleValue },
    ];
    const parametriFiltered = this.filterGridItems(parametriItems);
    if (parametriFiltered.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(
        SECONDARY_COLOR[0],
        SECONDARY_COLOR[1],
        SECONDARY_COLOR[2],
      );
      doc.text("PARAMETRI ATTUALI", MARGIN_L, y - 2);
      y = this.drawGridRow(doc, parametriItems, y);
    }

    if (options?.includeFetalGrowthChart) {
      let chartPoints = options.fetalGrowthDataPoints;
      if (!chartPoints?.length && stima?.calcolabile && stima.pesoGrammi != null) {
        const ga = parseGestationalWeeks(obs.settimaneGestazione ?? "");
        if (ga != null && ga >= FETAL_GROWTH_WEEK_RANGE.min && ga <= FETAL_GROWTH_WEEK_RANGE.max) {
          chartPoints = [{ gaWeeks: ga, pesoGrammi: stima.pesoGrammi }];
        }
      }
      if (chartPoints?.length) {
        y = this.pageBreak(doc, y, 92);
        y = this.drawFetalGrowthChart(doc, chartPoints, y);
      }
    }

    // ── Sections ──
    y = this.drawSection(doc, "ANAMNESI", obs.prestazione, y);
    y = this.drawSection(doc, "Dati Clinici", obs.problemaClinico, y);
    const SIEOG_NOTE =
      "Ecografia Office di supporto alla visita clinica. Non sostituisce le ecografie di screening previste dalle Linee Guida SIEOG, e di ciò si informa la persona assistita.";
    y = this.drawSection(
      doc,
      "ECOGRAFIA OFFICE / ESAME OBIETTIVO",
      obs.esameObiettivo,
      y,
      SIEOG_NOTE,
    );
    if (options?.includeEcografiaImages) {
      y = await this.drawEcografiaImages(doc, obs.ecografiaImmagini, y);
    }
    y = this.drawSection(doc, "Conclusioni e Terapia", obs.noteOstetriche, y);
    try {
      this.drawFooter(doc, doctor, footerOpts);
      return doc.output("blob") as Blob;
    } finally {
      PdfService.footerContext = null;
    }
  }

  /** PDF dedicato: foglio a parte per una singola richiesta esame complementare */
  static async generateRichiestaEsamePDF(
    patient: Patient,
    richiesta: RichiestaEsameComplementare,
    doctor: Doctor | null,
  ): Promise<Blob> {
    const doc = new jsPDF();
    let y = this.drawHeader(
      doc,
      "RICHIESTA ESAME COMPLEMENTARE",
      "Prescrizione esame",
      doctor,
      false,
    );
    y = this.drawPatientBox(doc, patient, richiesta.dataRichiesta, y);
    y = this.pageBreak(doc, y, 25);
    doc.setFillColor(ACCENT_COLOR[0], ACCENT_COLOR[1], ACCENT_COLOR[2]);
    doc.rect(MARGIN_L, y, PAGE_W, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.text(this.s("ESAME RICHIESTO"), MARGIN_L + 4, y + 3.5);
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    const nomeLines = doc.splitTextToSize(this.s(richiesta.nome), PAGE_W - 8);
    doc.text(nomeLines, MARGIN_L + 4, y);
    y += nomeLines.length * LINE_H + 2;
    if (richiesta.note && richiesta.note.trim()) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      const noteLines = doc.splitTextToSize(this.s(richiesta.note), PAGE_W - 8);
      doc.text(noteLines, MARGIN_L + 4, y);
      y += noteLines.length * LINE_H + 4;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
    doc.text("Data richiesta: " + this.formatDate(richiesta.dataRichiesta), MARGIN_L + 4, y);
    const prefs = await PreferenceService.getPreferences();
    this.drawFooter(doc, doctor, {
      showDoctorPhoneInPdf: prefs?.showDoctorPhoneInPdf as boolean | undefined,
      showDoctorEmailInPdf: prefs?.showDoctorEmailInPdf as boolean | undefined,
    });
    return doc.output("blob") as Blob;
  }

  /** PDF dedicato: certificato medico (assenza, idoneità, malattia, altro) */
  static async generateCertificatoPDF(
    patient: Patient,
    certificato: CertificatoPaziente,
    doctor: Doctor | null,
  ): Promise<Blob> {
    const doc = new jsPDF();
    const tipoLabels: Record<CertificatoPaziente["tipo"], string> = {
      assenza_lavoro: "Assenza da lavoro",
      idoneita: "Idoneità",
      malattia: "Malattia",
      altro: "Altro",
    };
    const tipoLabel = tipoLabels[certificato.tipo] || certificato.tipo;
    let y = this.drawHeader(
      doc,
      "CERTIFICATO MEDICO",
      tipoLabel,
      doctor,
      false,
    );
    y = this.drawPatientBox(doc, patient, certificato.dataCertificato, y, "DATA CERTIFICATO");
    y = this.pageBreak(doc, y, 25);
    doc.setFillColor(ACCENT_COLOR[0], ACCENT_COLOR[1], ACCENT_COLOR[2]);
    doc.rect(MARGIN_L, y, PAGE_W, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
    doc.text(this.s("TESTO DEL CERTIFICATO"), MARGIN_L + 4, y + 3.5);
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const descLines = doc.splitTextToSize(this.s(certificato.descrizione || ""), PAGE_W - 8);
    doc.text(descLines, MARGIN_L + 4, y);
    y += descLines.length * LINE_H + 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
    doc.text("Data certificato: " + this.formatDate(certificato.dataCertificato), MARGIN_L + 4, y);
    const prefs = await PreferenceService.getPreferences();
    this.drawFooter(doc, doctor, {
      showDoctorPhoneInPdf: prefs?.showDoctorPhoneInPdf as boolean | undefined,
      showDoctorEmailInPdf: prefs?.showDoctorEmailInPdf as boolean | undefined,
    });
    return doc.output("blob") as Blob;
  }
}
