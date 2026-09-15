# Vercel Deployment Guide - Notte Brava Anzio/Nettuno

Questa guida ti aiuterà a distribuire il gioco su Vercel.

## 📋 Prerequisiti

1. Account su [Vercel](https://vercel.com) (gratuito)
2. Il progetto pushato su GitHub/GitLab/Bitbucket
3. Git installato localmente

## 🚀 Step-by-Step Deployment

### 1. **Push su Git Repository**

```bash
git add .
git commit -m "Add Vercel configuration"
git push origin main
```

### 2. **Connetti Vercel al tuo Repository**

1. Vai su https://vercel.com/new
2. Seleziona il tuo provider (GitHub, GitLab, o Bitbucket)
3. Autorizza Vercel ad accedere ai tuoi repository
4. Seleziona il repository `notte-brava-anzio-nettuno`

### 3. **Configura il Progetto in Vercel**

Vercel dovrebbe auto-detectare le impostazioni, ma verifica:

- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**: (configurare se necessario, ad esempio NODE_ENV)

### 4. **Deploy**

Clicca il bottone "Deploy" e aspetta che il build si completi.

## 🎮 Dopo il Deployment

### URL del Tuo Gioco
- **Frontend**: `https://your-project-name.vercel.app`
- **Socket.io Connection**: Automaticamente indirizzato a `https://your-project-name.vercel.app/api`

### Testare la Connessione

1. Apri `https://your-project-name.vercel.app` nel browser
2. Il gioco dovrebbe connettersi automaticamente al server
3. Verifica nella console del browser (F12) che non ci siano errori di WebSocket

## ⚙️ Configurazione Avanzata

### Variabili di Ambiente

Se hai bisogno di aggiungere variabili di ambiente (es. API keys, database URLs):

1. Vai su Project Settings → Environment Variables
2. Aggiungi le variabili necessarie
3. Rideploy il progetto

### Logging e Debug

Per vedere i log del server:
1. Vai su Deployment → View Build Logs
2. Clicca su un deploy completato per vedere i dettagli

## 🔧 Troubleshooting

### "Socket.io Connection Failed"

Se il Socket.io non si connette:

1. Verifica che l'URL del server sia corretto nei client
2. Controlla che CORS sia configurato correttamente in `api/index.js`
3. Guarda i log di Vercel

### Build Errors

Se il build fallisce:

1. Verifica che `npm run build` funzioni localmente
2. Controlla che tutte le dipendenze siano installate
3. Guarda i build logs su Vercel

### Static Assets (immagini, suoni)

Se mancano asset:

1. Assicurati che i file siano in `src/` o `public/`
2. Vite dovrebbe includerli automaticamente nel build
3. Se necessario, aggiungi a `vite.config.js`

## 📝 Note Importanti

- **Production Build**: Vercel usa il comando `npm run build` configurato in `vercel.json`
- **Development Locale**: Usa `npm run dev` per testare localmente
- **Limiti Serverless**: Ogni richiesta ha timeout (default 60s), ma WebSocket connections sono mantenute
- **Auto-Deploy**: Ogni push a `main` triggerirà automaticamente un nuovo deploy

## 🤝 Supporto

Per problemi di deployment su Vercel:
- Documentazione ufficiale: https://vercel.com/docs
- Status page: https://www.vercel-status.com/
- Support: https://vercel.com/support

---

**Fatto!** Il tuo gioco dovrebbe ora essere live su Vercel! 🎉
