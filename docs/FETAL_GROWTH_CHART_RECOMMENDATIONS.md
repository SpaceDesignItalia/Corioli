# Raccomandazioni UX/UI: Grafico crescita fetale (EFW vs GA)

Documento di indirizzo per allineare il grafico dei centili di crescita fetale agli standard dei sistemi ostetrici professionali (es. Astraia, ViewPoint).

---

## 1. Leggibilità clinica

### 1.1 Etichette delle curve centili
- **Stato attuale:** curve senza etichette; centili 5, 10, 25, 50, 75, 90, 95.
- **Raccomandazione:** etichettare le curve con notazione standard **P3, P10, P25, P50, P75, P90, P97** (percentili).  
  Se si mantiene la tabella attuale (5–95), usare **P5, P10, P25, P50, P75, P90, P95** e indicare in legenda: *"Riferimento: curve Hadlock (EFW)"*.
- **Implementazione:** posizionare il testo (font 6–7 pt) alla fine destra di ogni curva (es. a 41–42 settimane), con colore/tratto leggermente diverso per P50 (es. linea più spessa + etichetta in bold). In stampa bianco/nero usare toni di grigio diversi (es. P50 più scuro).

### 1.2 Assi e tick
- **Stato attuale:** solo "20" e "42" sull’asse X; nessun tick sull’asse Y; "Peso (g)" e "Settimane" generici.
- **Raccomandazione:**
  - **Asse X (età gestazionale):** tick ogni 2 settimane (20, 22, 24, … 42) con linee di griglia verticali sottili (grigio chiaro) per lettura rapida della GA.
  - **Asse Y (peso in g):** tick a intervalli fissi e “tondi”, es. 0, 1000, 2000, 3000, 4000, 5000, 6000 (o 0–3500 se si restringe il range per il secondo trimestre). Griglia orizzontale sottile.
  - Etichette assi: **"Età gestazionale (settimane)"** e **"Peso fetale stimato (g)"** per chiarezza medico-legale.

### 1.3 Interpretazione rapida
- Titolo esplicito: **"Crescita fetale – Peso stimato (EFW) vs Età gestazionale"**.
- Sottotitolo con riferimento: **"Curve di riferimento: Hadlock"** (o INTERGROWTH-21st se adottato).
- In un angolo (es. in basso a destra) riportare in testo la **misura corrente**: es. *"EFW 1053 g – 28+0 sett – P50"* così che il valore sia leggibile anche senza “leggere” il grafico.

---

## 2. Visualizzazione dati

### 2.1 Misure del paziente
- **Stato attuale:** punti come cerchi pieni (ultimo più grande); nessun valore accanto.
- **Raccomandazione:**
  - **Punto corrente (ultima visita):** cerchio più grande (es. raggio 2–2.5 mm), bordo spesso nero, riempimento bianco (così resta visibile in B/N) oppure nero pieno con piccolo alone/cerchio esterno.
  - **Visite precedenti:** cerchi più piccoli (es. 1–1.2 mm), colore grigio medio (es. 100,100,100) o simbolo “x”/quadratino per distinguerli dalla visita attuale.
  - Accanto al punto **corrente** (o in legenda): annotare **EFW (g)** e **centile** (es. *"1053 g – 50°"*). Evitare di etichettare ogni punto storico per non affollare.

### 2.2 Traiettoria (storico)
- **Stato attuale:** punti multipli già supportati; nessuna linea di connessione.
- **Raccomandazione:** tracciare una **linea che connette i punti in ordine cronologico** (GA crescente). Stile: linea continua nera o grigio scuro, spessore 0.3–0.4 pt. Così si vede subito l’andamento (crescita regolare, rallentamento, accelerazione).
- **Ordine:** garantire che i punti siano sempre ordinati per data/GA prima del disegno.

### 2.3 Visibilità esame corrente
- Come sopra: marcatore più grande, bordo marcato, eventuale piccolo cerchio di “enfasi” (cerchio tratteggiato attorno al punto corrente).
- In legenda: **"● Visita corrente"** e **"○ Visite precedenti"** (o "— Traiettoria").

---

## 3. Standard medici

### 3.1 Hadlock vs INTERGROWTH-21st
- **Hadlock:** molto usato in ecografia ostetrica per EFW; la vostra tabella è già in linea con curve tipo Hadlock.
- **INTERGROWTH-21st:** standard internazionale (WHO); spesso usato per consistenza con altri Paesi e per pubblicazioni. Potrebbe essere un’opzione configurabile (es. in impostazioni: “Curve: Hadlock / INTERGROWTH-21st”).
- **Raccomandazione:** mantenere Hadlock come default; in legenda/sottotitolo indicare esplicitamente *"Hadlock (EFW)"*. Se in futuro si aggiunge INTERGROWTH-21st, mostrare la sigla nella legenda.

### 3.2 Range GA e peso
- **GA:** 20–42 settimane è appropriato per il grafico di routine (secondo/terzo trimestre). Per screening primo trimestre servirebbero grafici dedicati (CRL, ecc.).
- **Peso:** 0–6000 g è adeguato; il massimo in tabella (~5962 g a 42 sett) è clinicamente realistico. Opzione: asse Y con massimo 4000 o 5000 per “zoom” sul range più frequente, con nota che valori >4000 g sono fuori scala o su seconda scala.

### 3.3 Documentazione
- In calce al grafico (font piccolo): *"EFW: stima ecografica; formula Hadlock 4 parametri (o altra usata). Le curve sono indicative e non sostituiscono il giudizio clinico."*

---

## 4. Design per report PDF (A4)

### 4.1 Layout e dimensioni
- **Stato attuale:** grafico compatto (~44 pt altezza, larghezza pagina meno margini).
- **Raccomandazione:** dedicare al grafico **circa 55–65 mm di altezza** e **larghezza utile ~160–170 mm** (margini 15–20 mm), in modo che:
  - le etichette delle curve siano leggibili senza lente;
  - le griglie non siano troppo fitte (max 1 griglia ogni 2 settimane / ogni 1000 g).

### 4.2 Stampa in scala di grigi
- Curve: grigi diversi (es. P50 = 40, P10/P90 = 120, P5/P95 = 180) per distinguere i centili senza colore.
- Punto corrente: nero pieno o cerchio nero con interno bianco.
- Traiettoria: nero o grigio scuro (30–50).
- Griglia: grigio molto chiaro (220–240).
- Tutto il testo in nero (0,0,0) o grigio scuro (40,40,40).

### 4.3 Legenda e annotazioni
- **Posizione legenda:** in basso a sinistra sotto il grafico o in un riquadro a destra del grafico (se c’è spazio). Contenuto minimo:
  - Riferimento curve (Hadlock).
  - Simboli: ● visita corrente, ○ precedenti, — traiettoria.
  - Valore corrente: "EFW XXX g – GA XX+X sett – PXX".

### 4.4 Titolo e contesto
- Una riga sopra il grafico: titolo in grassetto (es. 9–10 pt).
- Una riga sotto il titolo (font 7 pt): riferimento e eventuale formula EFW usata.

---

## 5. Funzionalità aggiuntive

### 5.1 Annotazioni (data esame e centile)
- In **PDF** non ci sono tooltip; usare **annotazioni testuali**:
  - Accanto al punto corrente: *"28+0 – 1053 g (P50)"*.
  - Per più punti: solo sull’ultimo per non affollare; in legenda si può riportare *"N misure: 4"* o *"Prima misura: 22+0 – 478 g"*.

### 5.2 Evidenziare crescita anomala
- **Sotto P10 o sopra P90:** disegnare il punto corrente con un bordo spesso o un simbolo diverso (es. triangolino); opzionale breve nota in legenda: *"Valore al di fuori del range di normalità"*.
- **Colore (se in futuro si supporta stampa a colori):** punto sotto P10 in blu, sopra P90 in rosso; in B/N: simbolo “!” o cerchio tratteggiato per valori <P5 o >P95.

### 5.3 Best practice da software professionali
- **Astraia / ViewPoint / GE:** di solito includono:
  - Legenda chiara delle curve (P3–P97 o P5–P95).
  - Traiettoria temporale collegata.
  - Valore e centile dell’esame corrente in evidenza.
  - Riferimento bibliografico (Hadlock, INTERGROWTH) in carattere piccolo.
  - Possibilità di stampare in B/N senza perdere informazione.
- **Consiglio:** aggiungere un piccolo blocco “Dati grafico” sotto il grafico: *"Formula EFW: Hadlock 4p | Curve: Hadlock | Ultima misura: [data visita] – EFW XXX g – PXX"*.

---

## Priorità di implementazione suggerita

| Priorità | Elemento | Impatto | Complessità |
|----------|----------|---------|-------------|
| 1 | Etichette percentili sulle curve (P5, P10, … P95) | Alto | Bassa |
| 2 | Linea di traiettoria tra punti storici | Alto | Bassa |
| 3 | Tick e griglia assi (X ogni 2 sett, Y ogni 1000 g) | Alto | Media |
| 4 | Legenda (simboli + valore corrente EFW/centile) | Alto | Media |
| 5 | Marcatore visita corrente più visibile (bordo/alone) | Medio | Bassa |
| 6 | Evidenziazione valori <P10 o >P90 | Medio | Bassa |
| 7 | Sottotitolo con riferimento (Hadlock) e nota formula | Medio | Bassa |
| 8 | Blocco “Dati grafico” con data e formula | Basso | Bassa |

Questo documento può essere usato come specifica per gli sviluppatori e come base per il design definitivo del grafico nel report PDF.
