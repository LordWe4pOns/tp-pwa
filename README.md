# CollecBox — PWA Gestionnaire de collection

> Progressive Web App développée pour le cours de M2 Informatique (Université de Corse, 2026).
> Sujet : **"CollecBox" — Gestionnaire de collection (Vinyles, Mangas, Jeux vidéo, BD)**

---

## 🚀 Démarrage rapide en local

Pour tester la PWA avec son Service Worker, le Manifest et la page hors ligne, lancez un serveur HTTP local dans le dossier `exlibris/` :

```bash
cd exlibris

# Avec npx serve (prend en compte serve.json pour cleanUrls: false)
npx serve -l 3000
```

Ouvrez ensuite votre navigateur sur : [http://localhost:3000](http://localhost:3000)

> 💡 **Sur téléphone portable** : Connectez votre mobile au même réseau Wi-Fi local et ouvrez `http://<IP_DE_VOTRE_MACHINE>:3000`.

---

## 📋 Vérifications de conformité (cahier des charges)

### 1. Test du contenu public statique (SEO & Bots IA)
Les robots doivent voir les 3 graines d'exemple sans exécuter JavaScript :
```bash
curl -s -A "GPTBot" http://localhost:3000/ | grep -c "<li[ >]"
# Résultat attendu : 3
```

### 2. Test de la jumelle Markdown
```bash
curl -s -A "ClaudeBot" http://localhost:3000/notes.md
```

### 3. Test des en-têtes Markdown (noindex)
```bash
curl -sI http://localhost:3000/notes.md | grep -i "x-robots"
# Résultat attendu : x-robots-tag: noindex
```

### 4. Test du mode hors ligne
1. Ouvrez l'application dans Chrome/Firefox/Edge.
2. Ouvrez les DevTools (F12) → Onglet **Application** (ou **Réseau**).
3. Cochez **Offline** (Mode hors ligne).
4. Rechargez la page : l'interface et vos données restent immédiatement disponibles.
5. Ajoutez un objet hors ligne : il apparaît avec le statut *"En attente de synchronisation"*.
6. Décochez **Offline** : la reconnexion déclenche la vidange automatique de l'outbox vers le serveur.

---

## 📁 Arborescence des fichiers

```text
exlibris/
├── DOC-TECHNIQUE.md       # Document de conception technique complet (12 sections)
├── README.md              # Guide d'exécution et de test
├── app.js                 # Logique métier, IndexedDB idb v8, scanner caméra, Outbox
├── generate_icons.py      # Script de génération des icônes PNG
├── icons/                 # Icônes de l'application
│   ├── icon-192.png       # Icône 192x192 standard
│   ├── icon-192-maskable.png # Variante maskable 192x192
│   ├── icon-512.png       # Icône 512x512 standard
│   ├── icon-512-maskable.png # Variante maskable 512x512
│   └── icon.svg           # Icône vectorielle SVG
├── index.html             # App Shell, balises SEO/GEO, 3 graines statiques
├── llms.txt               # Description sémantique pour agents IA
├── manifest.json          # Web App Manifest PWA installable
├── notes.md               # Version texte jumelle de la page d'accueil
├── offline.html           # Page de secours lors d'échecs de navigation
├── robots.txt             # Directives pour moteurs de recherche et bots IA
├── serve.json             # Configuration du serveur statique local
├── style.css              # Styles responsive mobile-first, thème moderne
├── sw.js                  # Service Worker (Cache First, SWR, Background Sync)
└── _headers               # En-têtes HTTP pour déploiement Netlify
```

---

## 🛠️ Déploiement en production

L'application est prête à être déployée en 1 clic sur **Vercel** ou **Netlify** :
- **Vercel** : `vercel --prod`
- **Netlify** : `netlify deploy --prod --dir=.`
- **GitHub Pages** : Publier directement le dossier avec HTTPS automatique.
