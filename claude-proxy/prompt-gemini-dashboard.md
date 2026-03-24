# Prompt: Redesign Dashboard UI per Claude Proxy

## Contesto

Sto sviluppando **Claude Proxy**, un server locale Node.js che espone API REST compatibili con Anthropic Messages API. Ha una dashboard di monitoraggio e una pagina di login. Ho bisogno che tu ridisegni completamente il CSS/HTML di entrambe le pagine con un design moderno e professionale.

## Cosa devi produrre

Genera **due blocchi HTML completi** (pagina login + pagina dashboard), ciascuno con CSS inline dentro un tag `<style>`. Zero dipendenze esterne (no CDN, no Google Fonts, no JavaScript frameworks). Solo HTML + CSS puro.

---

## Pagina 1: Login

Struttura HTML attuale (mantieni gli stessi `name`, `id`, `action`):

```html
<div class="login-box">
  <h1>Claude Proxy</h1>
  <p>Inserisci la tua API key per accedere alla dashboard.</p>
  <!-- Opzionale: messaggio di errore -->
  <div class="error">Chiave API non valida.</div>
  <form method="POST" action="/dashboard/login">
    <label for="api_key">API Key</label>
    <input type="password" id="api_key" name="api_key" placeholder="La tua PROXY_API_KEY" required autofocus>
    <button type="submit">Accedi</button>
  </form>
</div>
```

### Requisiti design login:
- Centrata verticalmente e orizzontalmente nella pagina
- Card con effetto glassmorphism o neumorphism sottile
- Sfondo scuro con un gradiente animato sottile (CSS only, no JS)
- Logo/icona testuale stilizzata (usa un emoji o un simbolo unicode come ⚡ o ◈)
- Input field con stile moderno (bordo che si illumina al focus)
- Bottone con gradiente e hover effect
- Messaggio di errore con animazione shake
- Responsive (funziona su mobile)

---

## Pagina 2: Dashboard

Struttura HTML attuale. I valori tra `${...}` sono placeholder dinamici — lasciali così come sono:

```html
<h1>Claude Proxy Dashboard</h1>
<div class="grid">
  <div class="card">
    <div class="label">Queue Size</div>
    <div class="value ok">0</div>
  </div>
  <div class="card">
    <div class="label">Active Requests</div>
    <div class="value">0</div>
  </div>
  <div class="card">
    <div class="label">Total Requests</div>
    <div class="value">42</div>
  </div>
  <div class="card">
    <div class="label">Completed</div>
    <div class="value ok">38</div>
  </div>
  <div class="card">
    <div class="label">Errors</div>
    <div class="value err">4</div>
  </div>
  <div class="card">
    <div class="label">Circuit Breaker</div>
    <div class="value ok">closed</div>
  </div>
  <div class="card">
    <div class="label">Rate Limit Tokens</div>
    <div class="value warn">2</div>
  </div>
</div>
<p class="footer">Auto-refreshes every 5 seconds. Uptime: 3600s | <a href="/dashboard/logout">Logout</a></p>
```

### Requisiti design dashboard:
- Layout dark theme professionale (stile Grafana / Datadog / Vercel Dashboard)
- Header con titolo, un indicatore di stato (pallino verde "Online"), e link Logout
- Cards con:
  - Icona o simbolo per ogni metrica (unicode o emoji)
  - Effetto hover (scale o glow sottile)
  - Bordo sinistro colorato in base allo stato (verde=ok, giallo=warn, rosso=err)
  - Transizione smooth sui colori
- Grid responsive: 4 colonne su desktop, 2 su tablet, 1 su mobile
- Footer discreto con uptime e logout
- Aggiungi una sezione "Status Bar" in alto che mostra:
  - Pallino verde/rosso per lo stato del circuit breaker
  - Barra di progresso per i rate limit tokens (es. 7/10 disponibili)
- Se possibile, aggiungi una sottile animazione pulse sul pallino di stato

### Classi CSS per gli stati (mantieni queste):
- `.ok` → verde (servizio sano, valori normali)
- `.warn` → giallo/arancio (attenzione, rate limit basso)
- `.err` → rosso (errori, circuit breaker aperto)

---

## Vincoli tecnici

1. **Solo CSS inline** dentro `<style>` — il HTML verrà servito da un template string TypeScript
2. **Zero dipendenze esterne** — no CDN, no font remoti, no JS libraries
3. **Compatibile con tutti i browser moderni** (Chrome, Firefox, Edge, Safari)
4. **Dark theme obbligatorio** — sfondo principale molto scuro (#0a0a0f o simile)
5. **Palette colori suggerita** (puoi adattarla):
   - Background: `#0a0a0f`, `#12121a`
   - Cards: `#1a1a2e` con bordo `#2a2a3e`
   - Accent primario: `#6366f1` (indigo) o `#8b5cf6` (violet)
   - OK: `#10b981` o `#4ade80`
   - Warning: `#f59e0b` o `#fbbf24`
   - Error: `#ef4444` o `#f87171`
   - Testo primario: `#f1f5f9`
   - Testo secondario: `#64748b`
6. **Font stack**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif`
7. Il meta tag `<meta http-equiv="refresh" content="5">` deve restare nella dashboard (auto-refresh)
8. Le animazioni CSS devono essere performanti (usa `transform` e `opacity`, evita `width`/`height`)

## Output atteso

Restituiscimi i due HTML completi pronti da copiare. Devo poterli inserire direttamente nel mio codice TypeScript come template string.
