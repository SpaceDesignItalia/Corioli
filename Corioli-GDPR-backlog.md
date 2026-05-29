# Corioli — Backlog privacy, sicurezza e GDPR

**Data:** 20 maggio 2026  
**Ultimo aggiornamento implementazione:** 29 maggio 2026  
**Progetti:** Corioli (app desktop), Corioli-Dashboard-BE, Corioli-Dashboard-FE  
**Destinatari:** team tecnico e organizzativo

---

## 1. Interventi già completati (codice)

| Area | Intervento | Progetto |
|------|-----------|----------|
| API | Protezione endpoint sensibili (sessione dashboard + chiave API app desktop) | BE |
| API | Chiave `CLIENT_API_SECRET` / `VITE_CLIENT_API_SECRET` | BE + Corioli |
| API | CORS whitelist configurabile (`CORS_ORIGINS`, `FRONTEND_URL`) | BE |
| API | Rate limiting (auth, app desktop, API generali) | BE |
| API | Audit log su azioni sensibili + tabella `AuditLog` | BE |
| API | Allegati support non più pubblici senza auth | BE |
| App | Interceptor axios + token allegati support | Corioli |
| App | FAQ corretta (niente “DB criptato”, niente “zero invio server”) | Corioli |
| App | Cancellazione paziente: eliminazione anche documenti collegati | Corioli |
| Config | File `.env.example` | BE + Corioli |

### Implementato 29/05/2026 (punti 3.1, 3.2, 4)

| Area | Intervento | Progetto |
|------|-----------|----------|
| API | RBAC: stats/block/export ristretti (admin/editor; export solo admin) | BE |
| API | `helmet()`, validazione Zod login/register | BE |
| API | Logger senza email su login; fix null-check `user` | BE |
| API | Retention cron heartbeat/chat/audit + `docs/data-retention.md` | BE |
| API | Allegati support: `file_token` HMAC temporaneo (fallback `access_token` deprecato) | BE + Corioli |
| API | `DISABLE_AUTH_REGISTER` opzionale | BE |
| FE | Interceptor 401 → logout; `console` rimosso in build prod | Dashboard FE |
| FE | UI Audit log (`/audit-logs`, solo admin) | Dashboard FE |
| FE | Link privacy login + banner cookie sessione | Dashboard FE |
| FE | Polling ridotto (clienti 30s, chat 8s, conversazioni 20s) | Dashboard FE |
| App | Orbyt rimosso da `main.tsx` e dipendenze | Corioli |
| App | CF remoto **off** default; opt-in in Impostazioni | Corioli |
| App | Log import CSV senza PII; `drop` console in build prod | Corioli |
| App | Pagine Login/Register/reset orfane eliminate | Corioli |
| App | Policy chat supporto (banner + FAQ) | Corioli |
| App/UX | Privacy in Settings, export JSON diritto accesso, procedura `docs/GDPR-procedura-richieste.md` | Corioli |

---

## 2. Deploy e configurazione (da fare subito)

- [ ] **Produzione BE:** impostare `CLIENT_API_SECRET` (stesso valore usato in build app Corioli).
- [ ] **Produzione BE:** impostare `CORS_ORIGINS` con URL reale dashboard (es. `https://dashboard.corioli.it`).
- [ ] **Produzione BE:** eseguire `npx prisma migrate deploy` (migrazione tabella `AuditLog`).
- [ ] **Build app Corioli:** includere `VITE_CLIENT_API_SECRET` in CI/CD; ricompilare e distribuire agli utenti.
- [ ] **Verifica post-deploy:** login dashboard, heartbeat app, chat supporto, check aggiornamenti.
- [ ] **Sicurezza repo:** verificare che `SSL/Corioli.key` non sia nel repository; ruotare certificati se era committata.
- [ ] **Secret:** non committare `.env`; ruotare token GitHub se esposti in repo locale.

---

## 3. Priorità alta — tecnico

### 3.1 Backend (Dashboard BE)

- [x] Restringere ulteriormente RBAC (ruolo `viewer` vs `admin` su stats, block, export).
- [x] `helmet()` e validazione input con schema (Zod su auth).
- [x] Logger strutturato senza PII (email in `console.log` su login fallito).
- [x] Retention automatica: `HeartbeatLog` e chat supporto (cron + policy documentata).
- [x] URL allegati support con token temporaneo (`file_token`) invece di `access_token` in query (fallback legacy ancora accettato).
- [x] Correggere ordine null-check in `auth_controller` login.
- [x] Chiudere o limitare `POST /auth/register` (invito obbligatorio + env `DISABLE_AUTH_REGISTER`).
- [x] Interceptor 401 su Dashboard FE → logout + redirect login.
- [x] Rimuovere `console.error` con risposte Axios in build produzione FE.
- [x] UI audit log in dashboard (`GET /audit-logs` per admin).

### 3.2 App Corioli (desktop)

- [x] Rimuovere chiave Orbyt hardcoded in `main.tsx`; solo da env CI (Orbyt rimosso del tutto).
- [x] Default **off** per decodifica CF remota (Axerrio); opt-in in impostazioni.
- [x] Ridurre logging PII in import CSV e build production.
- [x] Aggiornamenti Windows affidabili — **via Microsoft Store** (pacchetto firmato da Microsoft; nessun certificato EV/OV richiesto per utenti Store). `verifyUpdateCodeSignature` resta `false` per eventuali build NSIS/GitHub (vedi `docs/windows-release-signing.md`).
- [x] Allineare o rimuovere pagine Login/Register non usate nel router.
- [x] Policy chat supporto: evitare dati paziente negli allegati.

---

## 4. Priorità media — prodotto e UX

- [x] **Informativa privacy** in-app (link Settings/FAQ) + link in login dashboard.
- [x] **Cookie policy** dashboard (banner sessione strettamente necessaria).
- [x] Sezione Help / Impostazioni con contatto DPO o canale richieste privacy (`privacy@corioli.it`).
- [x] Export strutturato “diritto di accesso” (JSON versionato `corioli.data-access` v1.0) — *non subset FHIR*.
- [x] Procedura documentata per richieste GDPR (`docs/GDPR-procedura-richieste.md`).
- [ ] Messaggio pre-aggiornamento app se in futuro si introduce cifratura DB (da fare con punto 5).
- [x] Ridurre polling dashboard (30s clienti, 8s chat) — WebSocket/SSE non implementato.

---

## 5. Priorità bassa / ultima — cifratura DB locale

> Rimandata di proposito: impatto maggiore sugli utenti già in produzione.

- [ ] Progettare migrazione `corioli.db` da chiaro a cifrato (SQLCipher o `safeStorage` Electron).
- [ ] Backup automatico pre-migrazione al primo avvio post-aggiornamento.
- [ ] Test su DB reali (dimensioni, tempi, rollback).
- [ ] Decidere se cifrare anche export backup `.json`.
- [ ] Lock app (PIN / credenziali OS) all’avvio.
- [ ] Comunicazione agli utenti esistenti prima del rilascio.

---

## 6. Conformità organizzativa (legale / processi)

Non risolvibili solo con codice — responsabilità titolare / DPO:

- [ ] **DPIA** (trattamento dati sanitari, app locale, chat supporto, telemetria).
- [ ] **Registro trattamenti** (art. 30 GDPR).
- [ ] **Informative** art. 13–14 (medici, pazienti indiretti, operatori dashboard).
- [ ] **Contratti art. 28** con sub-responsabili: hosting, Orbyt, Axerrio (CF), GitHub (update).
- [ ] **Procedura DSAR**: accesso, rettifica, cancellazione, portabilità (chi risponde, entro quali tempi) — bozza tecnica in `docs/GDPR-procedura-richieste.md`; approvazione legale.
- [ ] **Retention documentata** per log audit, heartbeat, chat, backup PostgreSQL e `uploads/support/` — policy tecnica in BE; allineamento legale.
- [ ] **Backup** DB e allegati cifrati, test restore, access control.
- [ ] **Formazione** medici: backup sicuro, no dati paziente in chat, protezione dispositivo.

---

## 7. Riepilogo per ruolo

| Ruolo | Azioni principali |
|-------|-------------------|
| **DevOps / Backend** | Deploy env, migrate, CORS prod, retention cron, helmet |
| **Frontend dashboard** | Privacy footer, 401 interceptor, UI audit log, riduzione polling |
| **Electron / Corioli** | Rebuild con `VITE_CLIENT_API_SECRET`, CF opt-in, aggiornamenti firmati |
| **Legal / DPO** | DPIA, informative, DPA sub-responsabili, procedura DSAR |
| **Product** | Testi in-app, FAQ, comunicazioni utenti |

---

## 8. Note architetturali

- **Dati paziente (cartella clinica):** restano sull’app desktop Corioli, non nel DB backend dashboard.
- **Backend dashboard:** medici/clienti, contatori aggregati pazienti/visite, chat supporto, licenze/aggiornamenti.
- **Audit log:** non include heartbeat ad alta frequenza; consultabile via `GET /api/v1/audit-logs` (solo admin).

---

*Documento generato a partire dall’analisi GDPR del codice (maggio 2026). Non sostituisce parere legale.*
