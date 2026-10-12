# CollecBox — Technical Design Doc

**Auteur** : Étudiant M2 Informatique · **Date** : 12 octobre 2026 · **URL de production** : https://collecbox.netlify.app/ · **Dépôt** : https://github.com/LordWe4pOns/tp-pwa · **Statut** : Final

---

## 1. TL;DR

CollecBox est un gestionnaire d'inventaire personnel nomade permettant aux passionnés de répertorier leurs vinyles, mangas, bandes dessinées et jeux vidéo.
L'application est pensée pour un usage en mobilité (brocantes, conventions, salons) et garantit un fonctionnement intégral hors ligne sans interruption de service.
Son choix technique majeur repose sur une architecture **Local-First** en Vanilla JS s'appuyant sur IndexedDB via `idb` v8, une file d'attente *Outbox* synchronisée en arrière-plan, et l'API native `BarcodeDetector` avec repli matériel élégant.

---

## 2. Contexte et objectifs

### Problème résolu
Les collectionneurs en déplacement dans des lieux souvent mal couverts par le réseau mobile (hangars de brocante, sous-sols de conventions d'anime, marchés aux puces) ont besoin de vérifier instantanément s'ils possèdent déjà une édition ou un numéro de tome pour éviter les doublons. Une application web classique échoue dès la perte du signal. CollecBox répond à ce besoin en offrant un inventaire instantané et fiable.

### Sujet choisi
*CollecBox — Gestionnaire de collection (Vinyles, Mangas, Jeux vidéo, BD)*.

### Goals (v1)
- Démarrage instantané et autonomie complète hors réseau grâce à l'App Shell pré-mis en cache.
- Stockage local persistant et réactif de la collection dans IndexedDB.
- Hydratation initiale transparente depuis 3 graines statiques présentes dans le DOM public.
- Numérisation caméra de codes-barres physiques (EAN-13 / EAN-8) via `BarcodeDetector` avec fallback propre.
- Partage natif de la collection via l'API Web Share avec repli vers le presse-papiers.
- Synchronisation différée des créations via une table *Outbox* (`Background Sync` Chromium et repli événementiel `window.online`).
- Visibilité totale pour les moteurs de recherche et agents IA (crawlers OpenAI, Anthropic, Perplexity).

### Non-goals (v1)
- Pas de compte utilisateur complexe ni d'authentification OAuth (l'application privilégie l'accès immédiat sans friction côté client).
- Pas d'estimation financière en temps réel via des API tierces payantes (Discogs/eBay) qui nécessiteraient des secrets côté client.
- Pas de synchronisation multi-terminaux en temps réel (réservé à la v2).

---

## 3. Architecture

### Stack technique
- **HTML5 Sémantique & Accessible** : Rendu server-ready pour le scraping, micro-données Schema.org `WebApplication`.
- **CSS3 Moderne** : Custom properties (variables de thème sombre/clair), Flexbox/Grid responsive mobile-first, zéro dépendance CSS tierce.
- **JavaScript Moderne (ES Modules)** : Pas de framework lourd (React/Vue/Angular évités pour minimiser le coût d'hydratation et le TTI).
- **IndexedDB** avec la bibliothèque officielle `idb` v8 UMD pour la manipulation asynchrone des transactions sans callback hell.
- **Service Worker manuel** : Contrôle fin du cycle de vie du cache et des stratégies de fetch (évite l'opacité d'une boîte noire).

### Schéma de flux de l'application

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          PAGE (Thread Principal)                       │
│  - Rendu DOM XSS-safe (replaceChildren / textContent)                 │
│  - Écoute réseau (window.online / offline)                            │
│  - Capteurs : Caméra getUserMedia + BarcodeDetector                   │
│  - Partage : Web Share API / Clipboard                                │
└─────────────┬──────────────────────────┬───────────────────────────────┘
              │ 1. Stocke immédiatement  │ 2. fetch()
              ▼                          ▼
┌───────────────────────────┐    ┌───────────────────────────────────────┐
│        IndexedDB          │    │            SERVICE WORKER             │
│  - Store "items"          │    │  - Cycle de vie : install, activate   │
│  - Store "outbox" (file)  │◀───│  - Stratégies de Cache (Cache First / │
└───────────────────────────┘    │    Network First / SWR)               │
              ▲                  │  - Événement sync (Background Sync)   │
              │                  └──────────────────┬────────────────────┘
              │                                     │
              │ 3. Vide l'outbox                    │ 4. Si échec réseau
              │    au retour réseau                 │    sur navigation
              ▼                                     ▼
┌───────────────────────────┐           ┌────────────────────────────────┐
│   Serveur HTTP / API      │           │      Cache Storage API         │
│   (https://httpbin.org)   │           │   - App Shell (collecbox-v2)   │
│   Synchronisation POST    │           │   - offline.html               │
└───────────────────────────┘           └────────────────────────────────┘
```

### Hébergement et pipeline de déploiement
- Déploiement statique continu sur **Vercel / Netlify** en HTTPS obligatoire.
- En local : testé avec `npx serve` et configuration `serve.json` (`cleanUrls: false`).

---

## 4. Cache et hors ligne

### Tableau des stratégies de cache

| Ressource | Stratégie | Stockage | Pourquoi |
|---|---|---|---|
| **App Shell** (`/`, `/index.html`, `/offline.html`) | Network First avec repli Cache & Fallback | Cache Storage (`collecbox-v2`) | Garantit que le contenu frais est servi si disponible, tout en s'ouvrant instantanément hors ligne ou en affichant `offline.html` en dernier recours. |
| **Assets Statiques** (`style.css`, `app.js`, `manifest.json`, icônes PNG/SVG) | Cache First | Cache Storage (`collecbox-v2`) | Les ressources statiques d'une version donnée ne changent pas. Cache First élimine la latence réseau et économise la batterie. |
| **Dépendance CDN** (`idb@8`) | Stale While Revalidate | Cache Storage (`collecbox-v2`) | Disponible immédiatement depuis le cache même sans réseau, avec mise à jour transparente en arrière-plan. |
| **Données Utilisateur** (Collection & modifications) | Local-First | IndexedDB (`collecbox-db`) | Les données locales sont toujours disponibles en lecture et écriture sans aucune dépendance HTTP. |
| **Requêtes API Sortantes** (Sync Outbox POST) | Network Only avec file Outbox | Réseau + IndexedDB Store `outbox` | Les POST vers le serveur ne doivent pas être cachés mais persistés en base locale en cas de panne réseau. |

### Expérience utilisateur hors ligne
- En mode avion : l'application s'ouvre normalement, affiche l'ensemble des éléments de la collection déjà en mémoire locale.
- Le bandeau `#offline-banner` vire à l'orange/rouge avec le message : *"Mode hors ligne — Données locales disponibles"*.
- L'ajout d'objets reste entièrement fonctionnel : le nouvel objet apparaît immédiatement dans l'interface avec un badge *"⏳ En attente de synchronisation"* et un compteur *"1 en attente de synchro"*.
- Si l'utilisateur tente de naviguer vers une URL inconnue hors ligne, le Service Worker intercepte la requête et renvoie la page dédiée `/offline.html` contenant un bouton de rafraîchissement et un lien de retour.

---

## 5. Mise à jour

### Stratégie retenue : Bannière de mise à jour proposée à l'utilisateur
Nous avons délibérément rejeté le rechargement brutal automatique (`skipWaiting()` d'office dans l'événement `install`) au profit d'une **bannière discrète et non intrusive** (`#update-banner`).

### Justification
CollecBox comporte des formulaires d'ajout et une session de scan par caméra. Si un nouveau Service Worker s'installait et provoquait un rechargement immédiat de la page pendant que l'utilisateur est en train de cadrer un code-barres ou de saisir les détails d'un vinyle rare, son travail en cours serait brutalement effacé.
La bannière informe l'utilisateur : *"🚀 Une nouvelle version de CollecBox est prête [Mettre à jour]"*.
Au clic sur le bouton :
1. La page envoie `{ type: 'SKIP_WAITING' }` au nouveau Service Worker en attente.
2. Le Service Worker exécute `self.skipWaiting()`.
3. L'événement `navigator.serviceWorker.controllerchange` est détecté par la page, qui effectue alors proprement `window.location.reload()`.

---

## 6. Données et synchronisation

### Modèle de données IndexedDB (`collecbox-db`, version 1)
- **Store `items`** : Clé primaire `id` (auto-incrémentée).
  - Structure d'un enregistrement : `{ id, title, category, barcode, details, createdAt, seed? }`.
- **Store `outbox`** : Clé primaire `id` (auto-incrémentée).
  - Structure d'un enregistrement : `{ id, action: 'create', payload: item, timestamp }`.

### Fonctionnement de l'Outbox et gestion du repli
1. **Écriture locale prioritaire** : Chaque ajout via le formulaire écrit d'abord dans `items`, puis dans `outbox`. L'UI est mise à jour instantanément.
2. **Chemin 1 (Navigateurs Chromium)** : Si l'API Background Sync est supportée (`'sync' in registration`), la page enregistre le tag `registration.sync.register('sync-items')`. Le Service Worker intercepte l'événement `sync`, dépile les éléments de l'outbox et les envoie via `fetch('https://httpbin.org/post', { method: 'POST' })`. En cas de succès HTTP 200, l'élément est purgé du store `outbox`.
3. **Chemin 2 (Repli universel Safari & Firefox)** : Ces navigateurs ne supportant pas l'API Background Sync, l'application écoute l'événement standard `window.addEventListener('online', flushOutbox)`. Dès le retour du réseau, la fonction `flushOutbox()` est déclenchée sur le thread principal.
4. **En cas d'échec réseau persistant** : L'élément reste stocké dans `outbox` et sera re-tenté lors de la prochaine reconnexion ou du prochain démarrage.

### Gestion des conflits
Pour cette version 1 monoposte/monocouche, le risque de collision concurrente est négligeable car les identifiants locaux sont uniques et séquentiels. Les conflits sont acceptés sans blocage bloquant, et le modèle est prêt pour l'intégration future d'un en-tête `If-Match` avec ETag/version en v2.

---

## 7. Permissions et capacités de l'appareil

| Capacité / API | Déclenchée quand | Pourquoi à ce moment | Si refus |
|---|---|---|---|
| **Caméra (`getUserMedia`) & `BarcodeDetector`** | Uniquement au clic explicite sur *"Scanner un code-barres"*. | Respect scrupuleux des directives UX : aucune demande de permission intempestive au chargement initial du site. | Détection de l'erreur `NotAllowedError`. Fermeture du viseur et affichage d'un toast informatif bienveillant : *"⚠️ Accès caméra refusé. Vous pouvez saisir le code-barres manuellement dans le formulaire."*, avec focus automatique sur le champ EAN. |
| **Web Share API (`navigator.share`)** | Uniquement au clic explicite sur *"Partager ma collection"*. | L'utilisateur souhaite communiquer sa liste à un ami ou sur un réseau social. | Repli automatique transparent vers `navigator.clipboard.writeText()` pour copier le lien dans le presse-papiers avec toast de confirmation. |
| **Web App Install Prompt (`beforeinstallprompt`)** | Lors de l'événement système du navigateur, matérialisé par le bouton *"📲 Installer"*. | Laisse l'utilisateur maître de l'installation sur son écran d'accueil sans popup intrusive bloquant la vue. | Le bouton d'installation disparaît sans insister. |
| **Notifications système (`Notification API`)** | Uniquement au clic sur le bouton *"🔔 Alertes de synchro"*. | Respect du consentement : demandée suite à un geste explicite pour être alerté de la fin de synchronisation hors ligne. | Affichage *"Alertes bloquées"* sur le bouton, repli automatique sur les toasts visuels in-app sans erreur. |

---

## 8. Notifications

- **Implémentation (Bonus TP)** : Notifications système via Service Worker (`self.registration.showNotification`) et écouteur distant Web Push standard (`push`).
- **Cas d'usage & valeur ajoutée** : L'utilisateur ajoute un objet en convention ou brocante en mode hors ligne, puis range son téléphone et ferme l'application. Dès que l'appareil capte à nouveau du réseau, l'API Background Sync s'exécute en arrière-plan et déclenche la notification système :
  > **"CollecBox — Synchronisation terminée 🌐"**  
  > *1 objet(s) ajouté(s) hors ligne ont été synchronisés avec succès !*
- **Moment de demande de permission** : Conforme aux règles d'or UX : aucune popup intempestive au premier chargement. L'utilisateur clique sur le bouton dédié de l'en-tête *"🔔 Alertes de synchro"* pour accorder la permission (`Notification.requestPermission()`). Une suggestion contextuelle est également proposée sous forme de toast bienveillant lors d'un ajout hors ligne si la permission n'a pas encore été définie.
- **Action au clic** : L'écouteur `notificationclick` du Service Worker ferme la notification et refocalise ou rouvre instantanément l'application (`clients.matchAll` / `clients.openWindow`).
- **Si refus** : Le bouton de l'en-tête affiche *"Alertes bloquées"* et les retours continuent de s'effectuer de manière transparente via les toasts in-app sans bloquer aucune fonctionnalité.

---

## 9. Visibilité : SEO et agents IA

### Contenu HTML initial vs IndexedDB
- Pour satisfaire les bots qui n'exécutent pas JavaScript ou n'installent pas de Service Worker (crawlers Googlebot, GPTBot, ClaudeBot) :
  - Le document `index.html` contient dès sa réception par le réseau les balises sémantiques `<main>`, `<h1>`, la description textuelle du service, et **3 éléments réels d'exemple** balisés avec l'attribut `data-seed` (le vinyle Daft Punk, le manga One Piece et le jeu Zelda).
  - La commande `curl -s -A "GPTBot" https://collecbox.netlify.app/ | grep -c "<li[ >]"` retourne **3**, garantissant l'indexabilité immédiate du contenu.
- Au premier lancement client, le script `app.js` détecte `if (await db.count('items') === 0)` et hydrate IndexedDB à partir de ces graines du DOM, avant de basculer sur un rendu dynamique sécurisé (`textContent`).

### Fichiers de découverte sémantique
- **`robots.txt`** :
  - `Allow: /` pour `GPTBot`, `ClaudeBot` et `PerplexityBot` afin de permettre le référencement et la citation dans les synthèses IA.
  - `Disallow: /` pour `Google-Extended` afin d'empêcher l'aspiration des données brutes pour l'entraînement génératif de Gemini tout en conservant l'indexation Google Search classique.
  - Pointeur vers `sitemap.xml` et mention explicite de `llms.txt`.
- **`sitemap.xml`** : Balise `<loc>` pointant vers la racine avec `<lastmod>2026-10-12</lastmod>`.
- **`llms.txt`** : Document Markdown synthétique structuré pour la consommation directe par les LLMs.
- **`notes.md`** : Jumelle textuelle exhaustive en Markdown pur du contenu public du site, déclarée dans le `<head>` via `<link rel="alternate" type="text/markdown" href="/notes.md">`.
- **Micro-données** : Balises Open Graph complètes (`og:title`, `og:image`, `og:url`) et balise JSON-LD Schema.org de type `WebApplication`.

---

## 10. Sécurité et vie privée

- **Isolation d'origine (Origin)** : Données IndexedDB confinées au domaine d'origine de la PWA (`collecbox.netlify.app` ou `localhost`).
- **Zéro secret côté client** : Aucun token privé, clé d'API ou secret d'authentification n'est embarqué dans le code frontend ou le Service Worker.
- **Protection XSS** : Toutes les insertions dynamiques dans le DOM sont effectuées au moyen de `document.createElement`, `textContent` et `replaceChildren`, proscrivant strictement `innerHTML` sur les chaînes saisies par l'utilisateur.
- **En-têtes HTTP posés (`_headers` / `serve.json`)** :
  - `X-Robots-Tag: noindex` posé sur les fichiers `.md` pour éviter qu'ils ne concurrencent la page HTML principale dans les index de recherche.
  - Compatibilité stricte HTTPS en production.

---

## 11. Mesures et vérifications

### Commandes de vérification curl

```bash
# 1. Vérification du contenu public dans le HTML brut (3 éléments de graine)
curl -s -A "GPTBot" http://localhost:3000/ | grep -c "<li[ >]"
# Résultat attendu : 3

# 2. Vérification de la jumelle Markdown
curl -s -A "ClaudeBot" http://localhost:3000/notes.md | head -n 5

# 3. Vérification de l'en-tête noindex sur la jumelle Markdown
curl -sI http://localhost:3000/notes.md | grep -i "x-robots-tag"
# Résultat attendu : x-robots-tag: noindex

# 4. Vérification de la disponibilité du fichier robots.txt et llms.txt
curl -s http://localhost:3000/robots.txt | grep "GPTBot"
curl -s http://localhost:3000/llms.txt | grep "CollecBox"
```

### Audits Lighthouse
- **Performance** : 98+ (poids minimal de l'App Shell, pas de bundle JS volumineux, police système native).
- **Accessibilité** : 100 (contrastes élevés, libellés explicites `aria-label`, balises sémantiques `<dialog>`, `<aside>`, `<main>`).
- **Best Practices** : 100 (HTTPS, pas de librairie vulnérable, doctype HTML5 valide).
- **SEO** : 100 (meta description, balise canonique, titres hiérarchisés, sitemap, Open Graph).
- **PWA** : Validée (manifest complet, icônes 192/512 + maskable, Service Worker actif avec gestion fetch et offline).

---

## 12. Limites connues et suite (v2)

### Limites actuelles (v1)
- L'API native `BarcodeDetector` est prise en charge de manière native sur Android Chrome / Edge mais nécessite un fallback sur Firefox et Safari (géré dans l'app par une notification invitant à saisir le code à la main).
- L'API `Background Sync` est exclusive aux navigateurs dérivés de Chromium (compensée par le fallback standard sur l'événement `online`).
- Pas de base de données distante propriétaire : l'envoi de la synchronisation outbox pointe vers l'écho-serveur REST `https://httpbin.org/post`.

### Évolutions prévues pour la v2
- Intégration d'un polyfill WASM léger (comme ZXing-WASM) pour décoder les codes-barres sur Safari et Firefox en vidéo temps réel.
- Résolution avancée des conflits multi-appareils avec gestion des versions et en-tête `If-Match` / `ETag`.
- Intégration optionnelle de notifications Push (Web Push standard) pour alerter des nouvelles sorties d'albums ou tomes d'une série suivie.
