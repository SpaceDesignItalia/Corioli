import jsPDF from "jspdf";
import { Patient, Visit, Doctor, RichiestaEsameComplementare } from "../types/Storage";
import { DoctorService, PreferenceService } from "./OfflineServices";
import { calcolaStimePesoFetale } from "../utils/fetalWeightUtils";

    // ─── Layout Constants ───────────────────────────────────────────────────────
    const MARGIN_L = 15;
    const MARGIN_R = 195;
    const PAGE_W = MARGIN_R - MARGIN_L;
    const LINE_H = 5;          // Compact line height
    const SECTION_GAP = 5;     // Minimal gap between sections

    // Colors - Elegant Monochrome
    const PRIMARY_COLOR = [20, 20, 20];       // Almost Black
    const SECONDARY_COLOR = [60, 60, 60];     // Dark Gray
    const ACCENT_COLOR = [240, 240, 240];     // Very Light Gray
    const BORDER_COLOR = [200, 200, 200];     // Light Gray

interface VisitPdfOptions {
    includeEcografiaImages?: boolean;
}

    export class PdfService {

    // ─── Text Sanitization ──────────────────────────────────────────────────
    private static sanitizeText(text: string): string {
        if (!text) return "";
        let result = "";
        for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i);
            switch (code) {
                case 224: result += "a'"; break;
                case 232: result += "e'"; break;
                case 233: result += "e'"; break;
                case 236: result += "i'"; break;
                case 242: result += "o'"; break;
                case 249: result += "u'"; break;
                case 192: result += "A'"; break;
                case 200: result += "E'"; break;
                case 201: result += "E'"; break;
                case 204: result += "I'"; break;
                case 210: result += "O'"; break;
                case 217: result += "U'"; break;
                case 195: {
                    const next = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
                    if (next === 160) { result += "a'"; i++; break; }
                    if (next === 168) { result += "e'"; i++; break; }
                    if (next === 169) { result += "e'"; i++; break; }
                    if (next === 172) { result += "i'"; i++; break; }
                    if (next === 178) { result += "o'"; i++; break; }
                    if (next === 185) { result += "u'"; i++; break; }
                    result += text[i]; break;
                }
                default: result += text[i]; break;
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

    private static val(v: string | number | undefined | null, fallback = "-"): string {
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

    /** Page break check — returns new Y or same Y */
    private static pageBreak(doc: jsPDF, y: number, needed = 40): number {
        if (y + needed > 275) { // Increased tolerance (less bottom margin)
            doc.addPage();
            return 20; // Start higher on new page
        }
        return y;
    }

    // ─── Header ─────────────────────────────────────────────────────────────
    private static drawHeader(doc: jsPDF, title: string, subtitle: string, doctor: Doctor | null, showDoctorInfo = true): number {
        let y = 15; // Start higher

        if (showDoctorInfo) {
            // 1. Doctor Name - Centered, Large
            const doctorName = doctor ? `Dott. ${doctor.nome} ${doctor.cognome}` : "Studio Medico";
            doc.setFont("times", "bold");
            doc.setFontSize(16);
            doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
            doc.text(this.s(doctorName.toUpperCase()), 105, y, { align: "center" });
            
            y += 5;

            // 2. Specialization - Centered
            if (doctor?.specializzazione) {
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
                doc.text(this.s(doctor.specializzazione.toUpperCase()), 105, y, { align: "center" });
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
            doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
            doc.text(this.s(subtitle), 105, y, { align: "center" });
            y += 8;
        } else {
            y += 4;
        }

        return y;
    }

    // ─── Patient Info Box ───────────────────────────────────────────────────
    private static drawPatientBox(doc: jsPDF, patient: Patient, visitDate: string, y: number): number {
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
        doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
        doc.text("DATI DEL PAZIENTE", MARGIN_L + 4, boxY + 4);
        doc.text("DATA VISITA: " + this.formatDate(visitDate), MARGIN_R - 4, boxY + 4, { align: "right" });

        // Content
        const contentY = boxY + 12;
        
        // Name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
        doc.text(this.s(`${patient.nome} ${patient.cognome}`), MARGIN_L + 4, contentY);

        // Details
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
        
        const age = this.calculateAge(patient.dataNascita);
        const details = [
            `Nato/a il: ${this.formatDate(patient.dataNascita)} ${age ? `(${age} anni)` : ""}`,
            `CF: ${patient.codiceFiscale || "-"}`,
            `Sesso: ${patient.sesso || "-"}`
        ].join("   •   ");

        doc.text(this.s(details), MARGIN_L + 4, contentY + 5);

        return boxY + boxHeight + 8; // Reduced spacing after box
    }

    // ─── Section Drawing ────────────────────────────────────────────────────
    private static drawSection(doc: jsPDF, title: string, content: string | undefined | null, y: number, note?: string): number {
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

        // Content
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5); // Slightly smaller font
        doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);

        const sanitized = this.s(content);
        const lines = doc.splitTextToSize(sanitized, PAGE_W - 4);
        doc.text(lines, MARGIN_L + 2, y);
        y += (lines.length * LINE_H);

        // Optional Note (Disclaimer)
        if (note) {
             y += 2;
             doc.setFont("helvetica", "italic");
             doc.setFontSize(7);
             doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
             const noteLines = doc.splitTextToSize(note, PAGE_W - 4);
             doc.text(noteLines, MARGIN_L + 2, y);
             y += (noteLines.length * 3);
        }

        return y + SECTION_GAP;
    }

    /** Draw a simple key-value row enclosed in lines - COMPACT */
    private static drawGridRow(doc: jsPDF, items: { label: string; value: string }[], y: number): number {
        const rowHeight = 10; // Reduced height
        const colWidth = PAGE_W / items.length;

        // Top line
        doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
        doc.setLineWidth(0.1);
        doc.line(MARGIN_L, y, MARGIN_R, y);

        items.forEach((item, i) => {
            const x = MARGIN_L + (colWidth * i);
            
            // Label
            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
            doc.text(this.s(item.label), x + (colWidth / 2), y + 3.5, { align: "center" });

            // Value
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(PRIMARY_COLOR[0], PRIMARY_COLOR[1], PRIMARY_COLOR[2]);
            doc.text(this.s(this.val(item.value)), x + (colWidth / 2), y + 7.5, { align: "center" });

            // Vertical divider (except last)
            if (i < items.length - 1) {
                doc.line(x + colWidth, y, x + colWidth, y + rowHeight);
            }
        });

        // Bottom line
        doc.line(MARGIN_L, y + rowHeight, MARGIN_R, y + rowHeight);

        return y + rowHeight + 6; // Reduced spacing after
    }

    /** Draw image gallery section for ecografia attachments */
    private static drawEcografiaImages(doc: jsPDF, images: string[] | undefined, y: number): number {
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
            row.forEach((image, col) => {
                const x = MARGIN_L + col * (tileWidth + gap);
                doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
                doc.setLineWidth(0.2);
                doc.rect(x, y, tileWidth, tileHeight);
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
                    const format = props.fileType || "JPEG";
                    doc.addImage(image, format, ox, oy, w, h);
                } catch {
                    doc.setFont("helvetica", "italic");
                    doc.setFontSize(8);
                    doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
                    doc.text("Immagine non disponibile", x + tileWidth / 2, y + tileHeight / 2, { align: "center" });
                }
            });
            y += tileHeight + 5;
        }

        return y + SECTION_GAP;
    }

    // ─── Footer ─────────────────────────────────────────────────────────────
    private static drawFooter(doc: jsPDF, doctor: Doctor | null) {
        const pageH = doc.internal.pageSize.height;
        const footerY = pageH - 15; // Lower footer
        
        doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
        doc.setLineWidth(0.1);
        doc.line(MARGIN_L + 20, footerY, MARGIN_R - 20, footerY);

        doc.setFontSize(7);
        doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
        
        let footerTextParts: string[] = [];
        if (doctor?.ambulatori && doctor.ambulatori.length > 0) {
            const amb = doctor.ambulatori.find(a => a.isPrimario) || doctor.ambulatori[0];
            footerTextParts.push(`${amb.nome}`);
            footerTextParts.push(`${amb.indirizzo}, ${amb.citta}`);
        }
        if (doctor?.telefono) footerTextParts.push(`Tel: ${doctor.telefono}`);
        if (doctor?.email) footerTextParts.push(`${doctor.email}`);

        const footerText = footerTextParts.join("  •  ");
        doc.text(this.s(footerText), 105, footerY + 6, { align: "center" });
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  PUBLIC METHODS
    // ═══════════════════════════════════════════════════════════════════════

    static async generateGynecologicalPDF(patient: Patient, visit: Visit, options?: VisitPdfOptions) {
        if (!visit.ginecologia) return;
        const gyn = visit.ginecologia;
        const isPediatric = visit.tipo === "ginecologica_pediatrica";
        const doctor = await DoctorService.getDoctor();
        const doc = new jsPDF();

        let y = this.drawHeader(
            doc,
            isPediatric ? "VISITA GINECOLOGICA PEDIATRICA" : "VISITA GINECOLOGICA",
            "Referto Specialistico",
            doctor
        );
        y = this.drawPatientBox(doc, patient, visit.dataVisita, y);

        // ── Anamnesi Grid ──
        if (isPediatric) {
            y = this.drawGridRow(doc, [
                { label: "MENARCA", value: gyn.menarca ?? "-" },
                { label: "VACCINAZIONE HPV", value: gyn.vaccinazioneHPV ? "SI" : "NO" },
                { label: "STADIO DI TANNER (F)", value: gyn.stadioTannerFemmina ?? "-" }
            ], y);
        } else {
            const partiValue = (gyn.partiSpontanei != null || gyn.partiCesarei != null)
                ? `${gyn.parti} (${gyn.partiSpontanei ?? 0} PS, ${gyn.partiCesarei ?? 0} TC)`
                : String(gyn.parti);
            const abortiValue = (gyn.abortiSpontanei != null || gyn.ivg != null)
                ? `${gyn.aborti} (${gyn.abortiSpontanei ?? 0} AS, ${gyn.ivg ?? 0} IVG)`
                : String(gyn.aborti);
            y = this.drawGridRow(doc, [
                { label: "GRAVIDANZE (G)", value: String(gyn.gravidanze) },
                { label: "PARTI (P)", value: partiValue },
                { label: "ABORTI (A)", value: abortiValue },
                { label: "ULTIMA MESTRUAZIONE", value: this.formatDate(gyn.ultimaMestruazione) }
            ], y);
        }

        // ── Sections ──
        y = this.drawSection(doc, "ANAMNESI", gyn.prestazione, y);
        y = this.drawSection(doc, "Anamnesi e Dati Clinici", gyn.problemaClinico, y);
        const SIEOG_NOTE = "Ecografia Office di supporto alla visita clinica. Non sostituisce le ecografie di screening previste dalle Linee Guida SIEOG, e di ciò si informa la persona assistita.";
        
        y = this.drawSection(doc, "ECOGRAFIA OFFICE / ESAME OBIETTIVO", gyn.esameBimanuale, y, SIEOG_NOTE);
        if (options?.includeEcografiaImages) {
            y = this.drawEcografiaImages(doc, gyn.ecografiaImmagini, y);
        }
        y = this.drawSection(doc, "Conclusioni e Terapia", gyn.terapiaSpecifica, y);
        this.drawFooter(doc, doctor);
        return doc.output("blob") as Blob;
    }

    static async generateObstetricPDF(patient: Patient, visit: Visit, options?: VisitPdfOptions) {
        if (!visit.ostetricia) return;
        const obs = visit.ostetricia;
        const [doctor, prefs] = await Promise.all([
            DoctorService.getDoctor(),
            PreferenceService.getPreferences(),
        ]);
        const formulaPesoFetale = (prefs?.formulaPesoFetale as string) || "hadlock4";
        const doc = new jsPDF();

        let y = this.drawHeader(doc, "VISITA OSTETRICA", "Monitoraggio della Gravidanza", doctor);
        y = this.drawPatientBox(doc, patient, visit.dataVisita, y);

        // ── Anamnesi Ostetrica Grid ──
        const partiPrecValue = (obs.partiPrecSpontanei != null || obs.partiPrecCesarei != null)
            ? `${obs.partiPrec} (${obs.partiPrecSpontanei ?? 0} PS, ${obs.partiPrecCesarei ?? 0} TC)`
            : String(obs.partiPrec);
        const abortiPrecValue = (obs.abortiPrecSpontanei != null || obs.ivgPrec != null)
            ? `${obs.abortiPrec} (${obs.abortiPrecSpontanei ?? 0} AS, ${obs.ivgPrec ?? 0} IVG)`
            : String(obs.abortiPrec);
        y = this.drawGridRow(doc, [
            { label: "GRAVIDANZE PREC.", value: String(obs.gravidanzePrec) },
            { label: "PARTI PREC.", value: partiPrecValue },
            { label: "ABORTI PREC.", value: abortiPrecValue },
            { label: "ULTIMA MESTRUAZIONE", value: this.formatDate(obs.ultimaMestruazione) }
        ], y);

        // ── Pregnancy Parameters Grid (con Peso fetale stimato) ──
        const biometria = obs.biometriaFetale ?? { bpdMm: 0, hcMm: 0, acMm: 0, flMm: 0 };
        const stimePeso = calcolaStimePesoFetale(biometria);
        const stima = stimePeso[formulaPesoFetale] ?? stimePeso.hadlock4;
        const pesoFetaleValue = stima?.calcolabile && stima.pesoGrammi != null
            ? `${stima.pesoGrammi} g`
            : "-";

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(SECONDARY_COLOR[0], SECONDARY_COLOR[1], SECONDARY_COLOR[2]);
        doc.text("PARAMETRI ATTUALI", MARGIN_L, y - 2);

        y = this.drawGridRow(doc, [
            { label: "SETT. GESTAZIONE", value: obs.settimaneGestazione },
            { label: "DATA PRESUNTA", value: this.formatDate(obs.dataPresunta) },
            { label: "PRESSIONE", value: obs.pressioneArteriosa },
            { label: "PESO ATTUALE", value: obs.pesoAttuale ? `${obs.pesoAttuale} kg` : "-" },
            { label: "INCREM. PONDERALE", value: (obs.pesoAttuale && obs.pesoPreGravidanza) ? `${(Number(obs.pesoAttuale) - Number(obs.pesoPreGravidanza)).toFixed(1)} kg` : "-" },
            { label: "PESO FETALE STIMATO", value: pesoFetaleValue }
        ], y);

        // ── Sections ──
        y = this.drawSection(doc, "ANAMNESI", obs.prestazione, y);
        y = this.drawSection(doc, "Dati Clinici", obs.problemaClinico, y);
        const SIEOG_NOTE = "Ecografia Office di supporto alla visita clinica. Non sostituisce le ecografie di screening previste dalle Linee Guida SIEOG, e di ciò si informa la persona assistita.";
        y = this.drawSection(doc, "ECOGRAFIA OFFICE / ESAME OBIETTIVO", obs.esameObiettivo, y, SIEOG_NOTE);
        if (options?.includeEcografiaImages) {
            y = this.drawEcografiaImages(doc, obs.ecografiaImmagini, y);
        }
        y = this.drawSection(doc, "Conclusioni e Terapia", obs.noteOstetriche, y);
        this.drawFooter(doc, doctor);
        return doc.output("blob") as Blob;
    }

    /** PDF dedicato: foglio a parte per una singola richiesta esame complementare */
    static async generateRichiestaEsamePDF(patient: Patient, richiesta: RichiestaEsameComplementare, doctor: Doctor | null): Promise<Blob> {
        const doc = new jsPDF();
        let y = this.drawHeader(doc, "RICHIESTA ESAME COMPLEMENTARE", "Prescrizione esame", doctor, false);
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
        doc.text(this.s(richiesta.nome), MARGIN_L + 4, y);
        y += 8;
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
        this.drawFooter(doc, doctor);
        return doc.output("blob") as Blob;
    }
}
