# Politica di Sicurezza

Grazie per aver aperto questo documento. Qui trovi il modello di minaccia del progetto, come segnalare una vulnerabilità e cosa aspettarti dopo.

## Versioni supportate

Retro Arcade Collection (Phaser 4) è mantenuto solo sull'ultima versione sul branch `main`.

| Versione | Stato |
|----------|-------|
| `main` | ✅ supportata |
| versioni precedenti / fork non upstream | ❌ non supportate |

## Modello di minaccia

Retro Arcade Collection è una **single-page application statica**:

- Nessun **backend**, nessuna **API**, nessuna **autenticazione**.
- Non raccoglie **dati personali**: niente analytics, niente cookie di tracciamento, niente account.
- Salva solo dati locali in `localStorage` (high score). Questi dati sono visibili e modificabili dall'utente stesso — non è una vulnerabilità, è una caratteristica architetturale.
- Carica risorse esterne solo da `cdn.jsdelivr.net` (Phaser 4 via CDN ESM) tramite HTTPS.

### Cosa è considerato problema di sicurezza

- **Cross-site scripting (XSS)** tramite input dell'utente (es. testo nei giochi finisce in `innerHTML` invece di `setText()`).
- **Vulnerabilità nelle dipendenze npm** in produzione che impattino il bundle o la catena di build.
- **Manomissione della catena di build** (npm scripts, GitHub Actions) che permettano di iniettare codice nel deploy.
- **Errori in `Content-Security-Policy`** o nelle intestazioni HTTP che riducano le difese del browser.

### Cosa *non* è un problema di sicurezza

- **Modificare il proprio `localStorage`** per falsare gli high score: il save è locale e personale.
- **Vedere il codice sorgente** nelle DevTools: il progetto è open source.
- **Bug nel rendering** (artefatti grafici, layout rotto): aprire una Issue normale.
- **Avvisi "low severity"** di `npm audit` su transitive dependencies non raggiungibili in produzione.

## Come segnalare una vulnerabilità

**Non aprire una Issue pubblica per problemi di sicurezza.**

### 1. GitHub Security Advisories (raccomandato)

Vai su **Security → Report a vulnerability** nel repository, oppure:

> `https://github.com/sirAlfry/retro-arcade-collection-phaser/security/advisories/new`

### 2. Email diretta

Oggetto: `[retro-arcade-phaser security]`

> alfredo.matteo.96@gmail.com

### Cosa includere

1. Descrizione del problema e impatto previsto
2. Passi per riprodurre (URL, browser, sistema operativo)
3. Proof-of-concept se disponibile
4. Eventuali suggerimenti per la mitigazione

## Cosa aspettarti dopo la segnalazione

- **Conferma di ricezione** entro **5 giorni lavorativi**
- **Prima valutazione** entro **14 giorni**
- **Fix e deploy**: dipende dalla severità
  - Critica (RCE, compromissione build): obiettivo entro 7 giorni
  - Alta (XSS sfruttabile): obiettivo entro 30 giorni
  - Media / bassa: nella prossima release pianificata
- **Disclosure coordinata**: dettagli pubblici solo dopo il fix

## Crediti

_(ancora nessuno: il primo potresti essere tu!)_

---

Grazie per contribuire alla sicurezza del progetto. 🛡️
