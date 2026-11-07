import type { Visit } from "../types/Storage";

type Ostetricia = NonNullable<Visit["ostetricia"]>;

const GIORNO_MS = 86_400_000;

/**
 * L'epoca gestazionale ("33+3") alla data della visita, dall'ultima
 * mestruazione. Vuota se una delle due date manca o se la distanza non e' una
 * gravidanza (zero giorni o piu' di 300), come il suggerimento accanto al campo.
 */
export function epocaAllaData(ultimaMestruazione: string, dataVisita: string): string {
  const um = Date.parse(`${ultimaMestruazione}T00:00:00Z`);
  const visita = Date.parse(`${dataVisita}T00:00:00Z`);
  if (!Number.isFinite(um) || !Number.isFinite(visita)) return "";
  const giorni = Math.round((visita - um) / GIORNO_MS);
  if (giorni <= 0 || giorni >= 300) return "";
  return `${Math.floor(giorni / 7)}+${giorni % 7}`;
}

/**
 * Quello che «Copia visita precedente» non riporta in una visita ostetrica:
 * cio' che si misura a ogni controllo. Restano storia, datazione (UM, DPP,
 * concepimento) e i testi da cui ripartire; l'epoca si ricalcola dall'UM alla
 * data della visita nuova.
 *
 * Prima si copiava tutto: il controllo a 33 settimane si apriva con l'epoca,
 * la biometria e le immagini di quello a 29, e se non si riscrivevano il
 * referto le stampava come nuove, con percentili e peso fetale di un mese prima.
 */
export function misureDaRifare(
  ultimaMestruazione: string,
  dataVisita: string,
): Pick<
  Ostetricia,
  | "settimaneGestazione"
  | "biometriaFetale"
  | "flussimetriaOmbelicale"
  | "crlMm"
  | "altezzaUterina"
  | "battitiFetali"
  | "movimentiFetali"
  | "pesoAttuale"
  | "pressioneArteriosa"
  | "frequenzaCardiaca"
  | "ecografiaImmagini"
> {
  return {
    settimaneGestazione: epocaAllaData(ultimaMestruazione, dataVisita),
    biometriaFetale: { bpdMm: 0, hcMm: 0, acMm: 0, flMm: 0 },
    flussimetriaOmbelicale: undefined,
    crlMm: undefined,
    altezzaUterina: "",
    battitiFetali: "",
    movimentiFetali: "",
    pesoAttuale: 0,
    pressioneArteriosa: "",
    frequenzaCardiaca: "",
    ecografiaImmagini: [],
  };
}
