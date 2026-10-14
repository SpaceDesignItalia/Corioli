/**
 * PROTOTIPO — Referto di Specialistica Ambulatoriale (RSA) in HL7 CDA R2 per il
 * Fascicolo Sanitario Elettronico 2.0.
 *
 * Riferimento: HL7 Italia IG CDA2 RSA v1.1 (Art-Decor, rilascio 2026-04-16)
 * https://hl7itig.art-decor.pub/hl7itig-html-20260416T111817/
 *
 * Non ancora validato con gli schematron ufficiali né con il Gateway FSE: serve
 * come base per la mappatura visita → CDA2. Mancano PDF/A con CDA incorporato,
 * firma PAdES e invio.
 */
import { AnamnesiStrutturata, Doctor, Patient, Visit } from "../../types/Storage";
import {
  ALL_ANAMNESI_CAMPO_KEYS,
  hasAnamnesiStrutturataContent,
  resolveAnamnesiLabel,
} from "../../utils/anamnesiStrutturata";
import { isValidCodiceFiscale, normalizeCodiceFiscale } from "../../utils/codiceFiscale";
import {
  computeBmi,
  computeHomaIr,
  formatBmiWithBand,
  formatHomaIrWithBand,
} from "../../utils/metabolicIndices";

export const OID = {
  LOINC: "2.16.840.1.113883.6.1",
  ICD9CM: "2.16.840.1.113883.6.103",
  CODICE_FISCALE: "2.16.840.1.113883.2.9.4.3.2",
  /** Anagrafe strutture di specialistica ambulatoriale (flusso STS11). */
  STS11: "2.16.840.1.113883.2.9.4.1.3",
  /** Reparto: codice struttura + disciplina. */
  REPARTO: "2.16.840.1.113883.2.9.4.1.6",
  CATALOGO_NAZIONALE_PRESTAZIONI: "2.16.840.1.113883.2.9.6.1.11",
  CATALOGO_PRESTAZIONI_TOSCANA: "2.16.840.1.113883.2.9.2.90.6.11",
} as const;

/** Voce codificata (prestazione, diagnosi, quesito) in un sistema identificato da OID. */
export interface CodiceFse {
  codice: string;
  descrizione: string;
  codeSystem: string;
  codeSystemName: string;
}

export interface StrutturaFse {
  nome: string;
  /** Codice STS11 assegnato dalla Regione alla struttura. */
  codiceSts11: string;
  /** Codice reparto (struttura + disciplina): formato da confermare con la Regione. */
  codiceReparto: string;
  /** Radice OID con cui la struttura identifica i propri documenti. */
  oidDocumenti: string;
}

export interface CdaRsaInput {
  patient: Patient;
  visit: Visit;
  doctor: Doctor;
  /** Il profilo medico di Corioli non ha ancora il CF: va aggiunto per l'FSE. */
  codiceFiscaleMedico: string;
  struttura: StrutturaFse;
  /** Almeno una: la sezione Prestazioni è obbligatoria. */
  prestazioni: CodiceFse[];
  quesito?: CodiceFse;
  diagnosi?: CodiceFse[];
  /** Ordine ed etichette dell'anamnesi strutturata configurati dal medico. */
  anamnesi?: { campi?: string[]; etichette?: Record<string, string> };
  /** Istante di compilazione e firma (default: adesso). */
  dataCompilazione?: Date;
  versione?: number;
}

export interface CdaRsaResult {
  xml: string;
  /** Bloccanti: il documento non va inviato. */
  errori: string[];
  /** Da valutare prima dell'invio (dati a maggior tutela, codifiche mancanti…). */
  avvisi: string[];
}

type Riga = { etichetta?: string; testo: string };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const pad = (n: number, len = 2) => String(Math.abs(n)).padStart(len, "0");

/** HL7 TS con fuso: YYYYMMDDHHMMSS+ZZZZ. */
function tsDateTime(d: Date): string {
  const off = -d.getTimezoneOffset();
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}` +
    `${off >= 0 ? "+" : "-"}${pad(Math.floor(Math.abs(off) / 60))}${pad(Math.abs(off) % 60)}`
  );
}

/** HL7 TS solo data da "YYYY-MM-DD" o ISO completo. */
const tsDate = (iso: string) => iso.slice(0, 10).replace(/-/g, "");

const fmtData = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

function narrativa(righe: Riga[]): string {
  return righe
    .filter((r) => r.testo.trim())
    .flatMap((r) => {
      const paragrafi = r.testo.trim().split(/\n+/);
      return paragrafi.map((p, i) =>
        i === 0 && r.etichetta
          ? `<paragraph><content styleCode="Bold">${esc(r.etichetta)}:</content> ${esc(p)}</paragraph>`
          : `<paragraph>${esc(p)}</paragraph>`,
      );
    })
    .join("\n        ");
}

function codeEl(tag: string, c: CodiceFse, extra = ""): string {
  return (
    `<${tag}${extra} code="${esc(c.codice)}" codeSystem="${c.codeSystem}" ` +
    `codeSystemName="${esc(c.codeSystemName)}" displayName="${esc(c.descrizione)}"/>`
  );
}

function sezione(
  templateId: string,
  loinc: string,
  loincDisplay: string,
  titolo: string,
  righe: Riga[],
  entries: string[] = [],
): string {
  const text = narrativa(righe);
  if (!text) return "";
  return `
  <component>
    <section>
      <templateId root="${templateId}"/>
      <code code="${loinc}" codeSystem="${OID.LOINC}" codeSystemName="LOINC" displayName="${loincDisplay}"/>
      <title>${esc(titolo)}</title>
      <text>
        ${text}
      </text>${entries.map((e) => `\n      ${e}`).join("")}
    </section>
  </component>`;
}

function righeAnamnesi(
  as: AnamnesiStrutturata,
  cfg: CdaRsaInput["anamnesi"],
): Riga[] {
  const chiavi = cfg?.campi?.length
    ? cfg.campi
    : [...ALL_ANAMNESI_CAMPO_KEYS, ...Object.keys(as).filter((k) => k.startsWith("custom_"))];
  return chiavi.map((k) => ({
    etichetta: `Anamnesi ${resolveAnamnesiLabel(k, cfg?.etichette).toLowerCase()}`,
    testo: as[k] ?? "",
  }));
}

function nomePersona(nome: string, cognome: string): string {
  return `<name><given>${esc(nome)}</given><family>${esc(cognome)}</family></name>`;
}

export function buildCdaRsa(input: CdaRsaInput): CdaRsaResult {
  const { patient, visit, doctor, struttura } = input;
  const errori: string[] = [];
  const avvisi: string[] = [];

  const cfPaziente = normalizeCodiceFiscale(patient.codiceFiscale ?? "");
  if (!cfPaziente) errori.push("Codice fiscale della paziente mancante.");
  else if (!isValidCodiceFiscale(cfPaziente)) errori.push("Codice fiscale della paziente non valido.");
  if (patient.codiceFiscaleGenerato) {
    errori.push("Codice fiscale della paziente generato all'import: va verificato su un documento.");
  }
  const cfMedico = normalizeCodiceFiscale(input.codiceFiscaleMedico);
  if (!isValidCodiceFiscale(cfMedico)) errori.push("Codice fiscale del medico mancante o non valido.");
  if (!input.prestazioni.length) errori.push("Nessuna prestazione indicata (sezione obbligatoria).");

  const gyn = visit.ginecologia;
  const isGyn = visit.tipo === "ginecologica" || visit.tipo === "ginecologica_pediatrica";
  if (!isGyn || !gyn) {
    errori.push(`Tipo di visita "${visit.tipo ?? "generale"}" non ancora supportato dal prototipo.`);
  }
  const isPed = visit.tipo === "ginecologica_pediatrica";

  if ((gyn?.ivg ?? 0) > 0) {
    avvisi.push(
      "Anamnesi con IVG: dato a maggior tutela dell'anonimato, serve il consenso esplicito " +
        "della paziente alla visibilità nel FSE (altrimenti il documento va oscurato).",
    );
  }
  if (!input.quesito) avvisi.push("Quesito diagnostico senza codifica ICD-9-CM.");
  if (!input.diagnosi?.length) avvisi.push("Nessuna diagnosi codificata ICD-9-CM.");

  const compilazione = input.dataCompilazione ?? new Date();
  const ts = tsDateTime(compilazione);
  const versione = input.versione ?? 1;
  const dataVisita = tsDate(visit.dataVisita);

  // ── Storia clinica ────────────────────────────────────────────────────────
  const storia: Riga[] = [];
  if (gyn) {
    if (isPed) {
      storia.push({ etichetta: "Menarca", testo: gyn.menarca ?? "" });
      storia.push({ etichetta: "Stadio di Tanner", testo: gyn.stadioTannerFemmina ?? "" });
      storia.push({ etichetta: "Vaccinazione HPV", testo: gyn.vaccinazioneHPV ? "Sì" : "No" });
    } else {
      if (gyn.ultimaMestruazione?.trim()) {
        storia.push({ etichetta: "Ultima mestruazione", testo: fmtData(gyn.ultimaMestruazione) });
      }
      const parti = gyn.partiSpontanei != null || gyn.partiCesarei != null
        ? `${gyn.parti} (${gyn.partiSpontanei ?? 0} PS, ${gyn.partiCesarei ?? 0} TC)` : String(gyn.parti);
      const aborti = gyn.abortiSpontanei != null || gyn.ivg != null
        ? `${gyn.aborti} (${gyn.abortiSpontanei ?? 0} AS, ${gyn.ivg ?? 0} IVG)` : String(gyn.aborti);
      storia.push({
        etichetta: "Storia ostetrica",
        testo: `Gravidanze ${gyn.gravidanze}, parti ${parti}, aborti ${aborti}`,
      });
    }
    if (hasAnamnesiStrutturataContent(visit.anamnesiStrutturata)) {
      storia.push(...righeAnamnesi(visit.anamnesiStrutturata!, input.anamnesi));
    } else {
      storia.push({ etichetta: "Anamnesi", testo: gyn.prestazione ?? "" });
    }
  }

  // ── Esame obiettivo e referto ─────────────────────────────────────────────
  const esameObiettivo: Riga[] = [];
  const referto: Riga[] = [];
  if (gyn) {
    const peso = Number(gyn.pesoCorporeo) || 0;
    const bmi = computeBmi(peso, patient.altezza);
    if (!isPed && peso > 0) {
      esameObiettivo.push({ etichetta: "Peso", testo: `${peso} kg` });
      if (bmi != null) esameObiettivo.push({ etichetta: "BMI", testo: formatBmiWithBand(bmi) });
    }
    referto.push({ etichetta: "Visita / Ecografia office", testo: gyn.esameBimanuale ?? "" });
    const homa = computeHomaIr(gyn.glicemiaDigiuno, gyn.insulinemiaDigiuno);
    if (!isPed && homa != null) {
      referto.push({
        etichetta: "Assetto metabolico (a digiuno)",
        testo:
          `glicemia ${gyn.glicemiaDigiuno} mg/dL, insulinemia ${gyn.insulinemiaDigiuno} microU/mL, ` +
          `HOMA-IR ${formatHomaIrWithBand(homa)}`,
      });
    }
    if (gyn.esameBimanuale?.trim()) {
      referto.push({
        testo:
          "Ecografia office di supporto alla visita clinica. Non sostituisce le ecografie di " +
          "screening previste dalle Linee Guida SIEOG, e di ciò si informa la persona assistita.",
      });
    }
    if (!gyn.esameBimanuale?.trim()) errori.push("Sezione Referto vuota (obbligatoria).");
  }

  // ── Sezioni ───────────────────────────────────────────────────────────────
  const quesitoEntry = input.quesito
    ? [`<entry>
        <observation classCode="OBS" moodCode="EVN">
          <code code="29298-7" codeSystem="${OID.LOINC}" codeSystemName="LOINC"/>
          ${codeEl("value", input.quesito, ' xsi:type="CD"')}
        </observation>
      </entry>`]
    : [];

  const prestazioniEntries = input.prestazioni.map((p) => `<entry typeCode="COMP">
        <act classCode="ACT" moodCode="EVN">
          <templateId root="2.16.840.1.113883.3.1937.777.63.10.1065"/>
          ${codeEl("code", p)}
          <effectiveTime value="${dataVisita}"/>
        </act>
      </entry>`);

  const diagnosiEntries = (input.diagnosi ?? []).map((d) => `<entry>
        <observation classCode="OBS" moodCode="EVN">
          <code code="29308-4" codeSystem="${OID.LOINC}" codeSystemName="LOINC" displayName="Diagnosi"/>
          <statusCode code="completed"/>
          ${codeEl("value", d, ' xsi:type="CD"')}
        </observation>
      </entry>`);

  const body = [
    sezione("2.16.840.1.113883.3.1937.777.63.10.1041", "29299-5", "Motivo della visita",
      "Quesito diagnostico", [{ testo: gyn?.problemaClinico ?? "" }], quesitoEntry),
    sezione("2.16.840.1.113883.3.1937.777.63.10.1040", "11329-0", "Storia Generale",
      "Storia clinica", storia),
    sezione("2.16.840.1.113883.2.9.10.1.9.3.6", "29545-1", "Osservazioni fisiche",
      "Esame obiettivo", esameObiettivo),
    sezione("2.16.840.1.113883.3.1937.777.63.10.1064", "62387-6", "Interventi",
      "Prestazioni", input.prestazioni.map((p) => ({ testo: `${p.codice} ${p.descrizione}` })),
      prestazioniEntries),
    sezione("2.16.840.1.113883.2.9.10.1.9.3.9", "47045-0", "Referto", "Referto", referto),
    sezione("2.16.840.1.113883.2.9.10.1.9.3.10", "29548-5", "Diagnosi", "Diagnosi",
      (input.diagnosi ?? []).map((d) => ({ testo: `${d.descrizione} (ICD-9-CM ${d.codice})` })),
      diagnosiEntries),
    // In Corioli conclusioni e terapia sono un campo unico: finiscono entrambe qui.
    sezione("2.16.840.1.113883.2.9.10.1.9.3.11", "55110-1", "Conclusioni",
      "Conclusioni e terapia", [{ testo: gyn?.terapiaSpecifica ?? "" }]),
  ].join("");

  const titolo = isPed ? "Referto di visita ginecologica pediatrica" : "Referto di visita ginecologica";
  const medico = nomePersona(doctor.nome, doctor.cognome);
  const idMedico = `<id root="${OID.CODICE_FISCALE}" extension="${esc(cfMedico)}" assigningAuthorityName="MEF"/>`;
  const idStruttura =
    `<id root="${OID.STS11}" extension="${esc(struttura.codiceSts11)}" assigningAuthorityName="Ministero della Salute"/>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <realmCode code="IT"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_MT000040UV02"/>
  <templateId root="2.16.840.1.113883.2.9.10.1.9.1" extension="1.1"/>
  <id root="${struttura.oidDocumenti}" extension="${esc(`${visit.id}.${versione}`)}" assigningAuthorityName="${esc(struttura.nome)}"/>
  <code code="11488-4" codeSystem="${OID.LOINC}" codeSystemName="LOINC" displayName="Nota di consulto"/>
  <title>${esc(titolo)}</title>
  <effectiveTime value="${ts}"/>
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25" codeSystemName="HL7 Confidentiality"/>
  <languageCode code="it-IT"/>
  <setId root="${struttura.oidDocumenti}" extension="${esc(visit.id)}" assigningAuthorityName="${esc(struttura.nome)}"/>
  <versionNumber value="${versione}"/>
  <recordTarget>
    <patientRole>
      <id root="${OID.CODICE_FISCALE}" extension="${esc(cfPaziente)}" assigningAuthorityName="MEF"/>
      <patient>
        ${nomePersona(patient.nome, patient.cognome)}
        <administrativeGenderCode code="${patient.sesso}" codeSystem="2.16.840.1.113883.5.1"/>
        <birthTime value="${tsDate(patient.dataNascita)}"/>
      </patient>
    </patientRole>
  </recordTarget>
  <author>
    <time value="${ts}"/>
    <assignedAuthor>
      ${idMedico}
      <assignedPerson>${medico}</assignedPerson>
    </assignedAuthor>
  </author>
  <custodian>
    <assignedCustodian>
      <representedCustodianOrganization>
        ${idStruttura}
        <name>${esc(struttura.nome)}</name>
      </representedCustodianOrganization>
    </assignedCustodian>
  </custodian>
  <legalAuthenticator>
    <time value="${ts}"/>
    <signatureCode code="S"/>
    <assignedEntity>
      ${idMedico}
      <assignedPerson>${medico}</assignedPerson>
    </assignedEntity>
  </legalAuthenticator>
  <componentOf>
    <encompassingEncounter>
      <effectiveTime value="${dataVisita}"/>
      <location>
        <healthCareFacility>
          <id root="${OID.REPARTO}" extension="${esc(struttura.codiceReparto)}"/>
          <serviceProviderOrganization>
            ${idStruttura}
            <name>${esc(struttura.nome)}</name>
          </serviceProviderOrganization>
        </healthCareFacility>
      </location>
    </encompassingEncounter>
  </componentOf>
  <component>
    <structuredBody>${body.replace(/\n/g, "\n    ")}
    </structuredBody>
  </component>
</ClinicalDocument>
`;

  return { xml, errori, avvisi };
}
