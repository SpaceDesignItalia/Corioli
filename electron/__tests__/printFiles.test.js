import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanupPrintDir, isPrintFileName, printFileName, writePrintFile } from "../printFiles.js";

let root;
let printDir;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "corioli-print-"));
  printDir = path.join(root, "stampe");
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const PDF_BASE64 = Buffer.from("%PDF-1.4 finto referto").toString("base64");

describe("PDF di stampa", () => {
  it("scrive il file nella cartella dell'app", () => {
    const p = writePrintFile(printDir, PDF_BASE64);
    expect(fs.existsSync(p)).toBe(true);
    expect(path.dirname(p)).toBe(printDir);
    expect(fs.readFileSync(p, "utf8")).toContain("%PDF-1.4");
  });

  it("crea la cartella se manca", () => {
    expect(fs.existsSync(printDir)).toBe(false);
    writePrintFile(printDir, PDF_BASE64);
    expect(fs.existsSync(printDir)).toBe(true);
  });

  it("due stampe ravvicinate non si sovrascrivono", () => {
    const a = writePrintFile(printDir, PDF_BASE64, new Date(2026, 7, 19, 10, 0, 0, 100));
    const b = writePrintFile(printDir, PDF_BASE64, new Date(2026, 7, 19, 10, 0, 0, 900));
    expect(a).not.toBe(b);
    expect(fs.readdirSync(printDir)).toHaveLength(2);
  });

  it("rifiuta un contenuto non valido", () => {
    expect(() => writePrintFile(printDir, "")).toThrow();
    expect(() => writePrintFile(printDir, null)).toThrow();
  });

  it("il nome file non contiene caratteri vietati da Windows", () => {
    expect(printFileName(new Date(2026, 7, 19, 9, 5, 3, 7))).toMatch(
      /^Corioli_stampa_20260819_090503_007\.pdf$/,
    );
    expect(printFileName()).not.toMatch(/[:/?*"<>|]/);
  });
});

describe("pulizia della cartella di stampa", () => {
  it("rimuove i PDF lasciati da una sessione precedente", () => {
    writePrintFile(printDir, PDF_BASE64, new Date(2026, 0, 1, 8, 0, 0));
    writePrintFile(printDir, PDF_BASE64, new Date(2026, 0, 1, 8, 0, 1));
    expect(cleanupPrintDir(printDir)).toHaveLength(2);
    expect(fs.readdirSync(printDir)).toHaveLength(0);
  });

  it("non tocca file che non ha creato lei", () => {
    fs.mkdirSync(printDir, { recursive: true });
    fs.writeFileSync(path.join(printDir, "referto_del_medico.pdf"), "documento personale");
    writePrintFile(printDir, PDF_BASE64);
    cleanupPrintDir(printDir);
    expect(fs.readdirSync(printDir)).toEqual(["referto_del_medico.pdf"]);
  });

  it("su cartella inesistente non fa nulla e non lancia", () => {
    expect(cleanupPrintDir(path.join(root, "mai-creata"))).toEqual([]);
  });

  it("riconosce solo i propri nomi file", () => {
    expect(isPrintFileName("Corioli_stampa_20260819_090503_007.pdf")).toBe(true);
    expect(isPrintFileName("referto.pdf")).toBe(false);
    expect(isPrintFileName("Corioli_stampa_x.txt")).toBe(false);
    expect(isPrintFileName(null)).toBe(false);
  });
});
