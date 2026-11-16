/**
 * Versione dimostrativa sul web (corioli.it/login → demo).
 * Si costruisce con `npm run build:demo`: nessun archivio su disco, nessun
 * server, nessuna telemetria. I dati di prova vivono solo in memoria e
 * spariscono quando si chiude o si ricarica la scheda.
 */
export const IS_DEMO = import.meta.env.VITE_DEMO === "true";
