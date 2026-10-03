# Cocographera — Deploy su GitHub Pages + Cloudflare Worker

Il sito è diviso in due parti, da pubblicare separatamente:

- **`site/`** — le pagine del sito e la dashboard: vanno su **GitHub Pages** (gratis).
- **`worker/`** — tutto quello che prima faceva PHP (login, salvataggio testi/FAQ/pacchetti/messaggi, invio email): va su **Cloudflare Workers** (gratis, piano Free abbondante per questo sito).

Le due parti comunicano via API: il sito chiama il Worker via internet, quindi possono stare su domini diversi.

---

## Parte 1 — Cloudflare Worker (il "backend")

### 1.1 Installa gli strumenti
Serve Node.js installato sul computer (scarica da nodejs.org se non ce l'hai). Poi, in un terminale, dentro la cartella `worker/`:

```
npm install -g wrangler
wrangler login
```

Si aprirà il browser per autorizzare l'accesso al tuo account Cloudflare (creane uno gratuito su cloudflare.com se non l'hai già, è lo stesso account dove hai il dominio).

### 1.2 Crea lo spazio dati (KV)
```
wrangler kv namespace create DATA
```
Il comando stampa qualcosa come:
```
kv_namespaces = [
  { binding = "DATA", id = "abcd1234..." }
]
```
Copia quell'`id` e incollalo in `worker/wrangler.toml`, al posto di `INCOLLA_QUI_ID_KV_NAMESPACE`.

### 1.3 Imposta i due segreti
```
wrangler secret put ADMIN_PASSWORD
```
Ti chiede di digitare la password iniziale della dashboard (cambiala al primo accesso, come prima).

```
wrangler secret put TOKEN_SECRET
```
Ti chiede una stringa segreta usata per firmare l'accesso alla dashboard: incolla una sequenza lunga e casuale (es. generata su https://1password.com/password-generator o con `openssl rand -hex 32` nel terminale). Non deve essere memorizzabile, va solo copiata una volta.

### 1.4 Pubblica il Worker
```
wrangler deploy
```
Al termine ti darà un indirizzo tipo:
```
https://cocographera-api.TUO-SUBDOMAIN.workers.dev
```
**Copia questo indirizzo**, serve nel passo successivo.

### 1.5 (Facoltativo ma consigliato) Dominio personalizzato per il Worker
Invece di lasciare l'indirizzo `workers.dev`, puoi far rispondere il Worker su `api.tuodominio.it`:
1. Nel pannello Cloudflare del tuo dominio, vai su Workers Routes (o "Domini personalizzati" nella sezione del Worker).
2. Aggiungi `api.tuodominio.it` come dominio personalizzato del Worker `cocographera-api`.
3. Cloudflare crea da solo il record DNS necessario (deve restare "proxied", nuvoletta arancione).

Se lo fai, userai `https://api.tuodominio.it` al posto dell'indirizzo `workers.dev` nel passo 2.

---

## Parte 2 — Collegare il sito al Worker

Nei file del sito ho lasciato un segnaposto da sostituire in **7 punti** (con "trova e sostituisci" su tutta la cartella `site/`, cercando `TUO-SUBDOMAIN`):
`https://cocographera-api.TUO-SUBDOMAIN.workers.dev`

Sostituiscilo con l'indirizzo reale del tuo Worker (quello del passo 1.4, o il tuo dominio personalizzato del passo 1.5) in questi file:
- `site/index.html` (attributo `data-api-base` nel `<body>`, e `action` del form contatti)
- `site/it/index.html` (stessi due punti)
- `site/en/index.html` (stessi due punti)
- `site/admin/index.html` (attributo `data-api-base`)

Puoi farlo anche con "trova e sostituisci" nell'editor che preferisci (VS Code, Blocco Note, ecc.).

**Nota su `robots.txt` e `sitemap.xml`**: contengono anch'essi un segnaposto, `__SITE_URL__` — sostituiscilo con l'indirizzo pubblico definitivo del sito (es. `https://cocographera.it`, senza slash finale).

---

## Parte 3 — GitHub Pages (il sito)

### 3.1 Crea il repository
1. Su github.com crea un nuovo repository (es. `cocographera-website`), anche privato se preferisci — GitHub Pages funziona comunque, ma su piano gratuito i repository privati con Pages richiedono un account GitHub Pro; se non vuoi pagare, rendilo pubblico.
2. Carica **tutto il contenuto della cartella `site/`** (non la cartella stessa, il suo contenuto) nella radice del repository: `index.html`, `script.js`, `style.css`, le cartelle `it/`, `en/`, `admin/`, `assets/`, `.nojekyll`, `robots.txt`, `sitemap.xml`, `price-config.js`.

Puoi farlo da browser (trascinando i file nella pagina del repository, "Add file" > "Upload files") oppure con Git da terminale:
```
git init
git add .
git commit -m "Sito Cocographera"
git branch -M main
git remote add origin https://github.com/TUO-UTENTE/cocographera-website.git
git push -u origin main
```

### 3.2 Attiva GitHub Pages
Nel repository: Settings > Pages > sotto "Build and deployment", scegli "Deploy from a branch", branch `main`, cartella `/ (root)`, salva.

Dopo un minuto il sito sarà online su `https://TUO-UTENTE.github.io/cocographera-website/`.

### 3.3 Collega il tuo dominio Cloudflare (facoltativo)
1. Nel repository, Settings > Pages > "Custom domain": scrivi il tuo dominio (es. `cocographera.it`) e salva. GitHub crea un file `CNAME` nel repository.
2. Su Cloudflare, DNS del dominio: aggiungi un record CNAME con nome `@` (o `www`) che punta a `TUO-UTENTE.github.io`. Se usi l'apice nudo (`@`), Cloudflare lo gestisce come "CNAME flattening" automaticamente.
3. Aspetta la propagazione, poi su GitHub Pages spunta "Enforce HTTPS" quando diventa disponibile.

Con questo NON serve più lo swap temporaneo dei nameserver spiegato per altri hosting: GitHub Pages funziona con un semplice record CNAME su Cloudflare, senza toccare i nameserver.

---

## Parte 4 — Primo accesso e configurazione

1. Apri `https://tuodominio.it/admin/` (o l'indirizzo GitHub Pages).
2. Accedi con la password che hai impostato al passo 1.3 (il campo "Username" nel form non viene controllato, scrivi quello che vuoi).
3. Vai su **Impostazioni** e cambia subito la password iniziale.
4. Prova a modificare un testo, una FAQ, un pacchetto: si salvano nello spazio KV di Cloudflare e sono subito visibili sul sito.

---

## Differenze rispetto alla versione Altervista (da sapere)

- **Niente più file PHP**: tutto il salvataggio dati passa dal Worker e da Cloudflare KV, non più da file `.json` nella cartella `data/`.
- **Le FAQ ora si caricano via JavaScript** invece di essere scritte direttamente nell'HTML da PHP: funzionalmente identico per i visitatori, ma un crawler che non esegue JavaScript (rari, Google lo fa) vedrebbe temporaneamente le FAQ di partenza incluse nel codice finché non le modifichi dalla dashboard.
- **Le immagini caricate dalla dashboard per i pacchetti** vengono servite dal Worker (`/api/asset/...`), non salvate come file nella cartella `assets/` — Cloudflare KV le tiene al sicuro, ma se un giorno vuoi spostare tutto altrove ricordati che non sono file scaricabili da FTP.
- **Password**: ora è salvata come hash nel KV, verificata dal Worker — stesso livello di sicurezza di prima, gestione più semplice (nessun file `auth.json` da proteggere via `.htaccess`).
- **Contatti**: non c'è più un modulo contatti. La sezione "Contatti" del sito invita i visitatori a scrivere direttamente su Instagram (link cliccabile nella frase, più il pulsante Instagram già in navbar e nel footer). Nessuna email da configurare, nessun servizio esterno (Brevo) necessario.
