# Procedura richieste GDPR (Corioli)

**Versione:** 1.0 — maggio 2026  
**Ambito:** app desktop Corioli (dati paziente in locale), dashboard operatori, sito corioli.it

## Ruoli

| Attore | Responsabilità |
|--------|----------------|
| Medico (titolare) | Dati sanitari in app locale; risponde al paziente per cartella clinica |
| Corioli / Space Design | Piattaforma, licenze, assistenza, dashboard; contatto `privacy@corioli.it` |
| Paziente | Richieste verso il medico titolare; Corioli supporta il medico con strumenti export |

## Canali

- **App desktop:** Impostazioni → Backup e dati → «Esporta pacchetto diritto di accesso (JSON)»; contatto `privacy@corioli.it` per questioni sul software.
- **Dashboard medici/operatori:** ticket chat assistenza (no dati paziente negli allegati) o email privacy.
- **Sito:** [Informativa privacy](https://corioli.it/privacy-policy).

## Tipi di richiesta

| Diritto | Chi gestisce | Strumento / azione | Termine indicativo |
|---------|--------------|-------------------|-------------------|
| Accesso (art. 15) | Medico titolare | Export JSON in app; copia cartella su richiesta formale | 30 giorni |
| Rettifica | Medico | Modifica scheda in app | Senza ritardo ingiustificato |
| Cancellazione | Medico | Eliminazione paziente in app (+ documenti collegati) | 30 giorni |
| Portabilità | Medico | Export JSON / backup `.json` | 30 giorni |
| Limitazione / opposizione | Medico + Corioli se trattamento cloud | Valutazione caso per caso | 30 giorni |
| Reclamo Garante | Interessato | — | — |

## Flusso operativo (Corioli come fornitore software)

1. Ricezione richiesta a `privacy@corioli.it` (o inoltrata dal medico).
2. Verifica identità richiedente e legittimazione.
3. Se i dati sono **solo in locale** sul PC del medico → istruzioni al medico per export; Corioli non accede al DB paziente.
4. Se i dati sono su **backend dashboard** (account medico, chat supporto, heartbeat) → estrazione da DB PostgreSQL / log secondo retention documentata (`Corioli-Dashboard-BE/docs/data-retention.md`).
5. Risposta tracciata; eventuale registrazione in registro trattamenti (organizzativo).

## Note tecniche

- Retention automatica: heartbeat, chat supporto, audit log (variabili env backend).
- Allegati chat: policy in-app; non sostituisce formazione medici.
- Cifratura DB locale: backlog punto 5 (non ancora in produzione).

*Documento operativo interno; non sostituisce parere legale.*
