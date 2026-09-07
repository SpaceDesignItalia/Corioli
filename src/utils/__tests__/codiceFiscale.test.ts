import { describe, expect, it } from "vitest";
import {
  codiceFiscaleControlChar,
  codiceFiscaleError,
  isValidCodiceFiscale,
  isValidCodiceFiscaleFormat,
  normalizeCodiceFiscale,
} from "../codiceFiscale";

describe("codice fiscale valido", () => {
  it("accetta codici corretti", () => {
    for (const cf of [
      "MRTMTT91D08F205J",
      "VRDGPP80A01F205X",
      "RSSMRA80A01H501U",
      "BNCMRA85T41H501W", // donna: giorno 41 = 1 + 40
    ]) {
      expect(codiceFiscaleError(cf), cf).toBeNull();
      expect(isValidCodiceFiscale(cf), cf).toBe(true);
    }
  });

  it("normalizza spazi e minuscole", () => {
    expect(normalizeCodiceFiscale(" mrtmtt91d08f205j ")).toBe("MRTMTT91D08F205J");
    expect(isValidCodiceFiscale(" mrtmtt91d08 f205j ")).toBe(true);
  });

  it("accetta i codici omocodi (cifre sostituite da lettere)", () => {
    expect(codiceFiscaleError("MRTMTT91D08F20RE")).toBeNull();
  });

  it("calcola il carattere di controllo", () => {
    expect(codiceFiscaleControlChar("MRTMTT91D08F205")).toBe("J");
    expect(codiceFiscaleControlChar("VRDGPP80A01F205")).toBe("X");
  });
});

describe("codice fiscale errato", () => {
  it("non segnala nulla se il campo è vuoto (è opzionale)", () => {
    expect(codiceFiscaleError("")).toBeNull();
    expect(codiceFiscaleError("   ")).toBeNull();
    expect(isValidCodiceFiscale("")).toBe(false);
  });

  it("segnala la lunghezza sbagliata", () => {
    expect(codiceFiscaleError("MRTMTT91D08")).toMatch(/16 caratteri/);
    expect(codiceFiscaleError("MRTMTT91D08F205JX")).toMatch(/16 caratteri/);
  });

  it("segnala i caratteri non ammessi", () => {
    expect(codiceFiscaleError("MRTMTT91D08F205-")).toMatch(/lettere e numeri/);
  });

  it("segnala il formato sbagliato", () => {
    // Cifre al posto delle prime sei lettere.
    expect(codiceFiscaleError("123456 91D08F205J".replace(" ", ""))).toMatch(
      /Formato/,
    );
    // "Z" non è una lettera di mese valida.
    expect(codiceFiscaleError("MRTMTT91Z08F205J")).toMatch(/Formato/);
  });

  it("segnala un giorno di nascita inesistente", () => {
    expect(codiceFiscaleError("MRTMTT91D00F205V")).toMatch(/giorno di nascita/);
  });

  it("segnala il carattere di controllo sbagliato (es. un refuso)", () => {
    expect(codiceFiscaleError("MRTMTT91D08F205A")).toMatch(/controllo/);
    expect(isValidCodiceFiscale("MRTMTT91D08F205A")).toBe(false);
    // Refuso su una cifra del codice catastale: struttura ok, controllo no.
    expect(codiceFiscaleError("MRTMTT91D08F206J")).toMatch(/controllo/);
  });

  it("isValidCodiceFiscaleFormat controlla solo la struttura", () => {
    expect(isValidCodiceFiscaleFormat("MRTMTT91D08F205A")).toBe(true);
    expect(isValidCodiceFiscaleFormat("MRTMTT91D08")).toBe(false);
  });
});
