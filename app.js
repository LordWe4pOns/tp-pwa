/**
 * CollecBox — Logique Métier, Hydratation, Capacités Matérielles & Outbox
 * Conforme au cahier des charges PWA M2 Informatique.
 */

// 1. Initialisation IndexedDB via idb v8 (UMD)
const DB_NAME = 'collecbox-db';
const DB_VERSION = 1;

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    if (!window.idb) {
      console.error('La librairie idb v8 n\'a pas été chargée.');
      return Promise.reject(new Error('idb non disponible'));
    }
    dbPromise = window.idb.openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('items')) {
          db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('outbox')) {
          db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

// 2. Gestion de l'interface & Toasts
const elements = {
  updateBanner: document.getElementById('update-banner'),
  btnUpdate: document.getElementById('btn-update'),
  networkStatusDot: document.getElementById('network-status-dot'),
  networkStatusText: document.getElementById('network-status-text'),
  btnInstall: document.getElementById('btn-install'),
  btnScan: document.getElementById('btn-scan'),
  btnShare: document.getElementById('btn-share'),
  itemForm: document.getElementById('item-form'),
  itemTitle: document.getElementById('item-title'),
  itemCategory: document.getElementById('item-category'),
  itemBarcode: document.getElementById('item-barcode'),
  itemDetails: document.getElementById('item-details'),
  collectionList: document.getElementById('collection-list'),
  collectionCount: document.getElementById('collection-count'),
  outboxCount: document.getElementById('outbox-count'),
  scannerModal: document.getElementById('scanner-modal'),
  scannerVideo: document.getElementById('scanner-video'),
  scannerFeedback: document.getElementById('scanner-feedback'),
  btnCloseScanner: document.getElementById('btn-close-scanner'),
  btnStopScanner: document.getElementById('btn-stop-scanner'),
  toastContainer: document.getElementById('toast-container'),
  btnNotif: document.getElementById('btn-notif'),
  notifLabel: document.getElementById('notif-label'),
};

function showToast(message, duration = 3500) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(16px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// 3. Hydratation depuis les graines statiques HTML (<li data-seed>)
async function hydrateInitialSeeds() {
  const db = await getDB();
  const count = await db.count('items');

  if (count === 0) {
    const seedElements = elements.collectionList.querySelectorAll('[data-seed]');
    for (const el of seedElements) {
      const title = el.querySelector('.item-title')?.textContent?.trim() || 'Sans titre';
      const category = el.getAttribute('data-category') || 'Vinyle';
      const meta = el.querySelector('.item-meta')?.textContent?.trim() || '';
      const codeText = el.querySelector('.item-code')?.textContent?.trim() || '';
      const barcode = codeText.replace(/EAN\s*:\s*/i, '').trim();

      await db.add('items', {
        title,
        category,
        details: meta,
        barcode,
        createdAt: Date.now(),
        seed: true,
      });
    }
  }

  await renderCollection();
}

// 4. Rendu sécurisé (XSS-safe via createElement & textContent)
async function renderCollection() {
  const db = await getDB();
  const items = await db.getAll('items');
  const outboxItems = await db.getAll('outbox');

  // IDs d'objets en attente d'envoi dans l'outbox
  const pendingItemIds = new Set(
    outboxItems.map((o) => o.payload?.localId).filter(Boolean)
  );

  // Mise à jour des compteurs
  elements.collectionCount.textContent = `${items.length} objet${items.length > 1 ? 's' : ''}`;
  if (outboxItems.length > 0) {
    elements.outboxCount.hidden = false;
    elements.outboxCount.textContent = `${outboxItems.length} en attente de synchro`;
  } else {
    elements.outboxCount.hidden = true;
  }

  // Reconstruction propre de la liste
  const fragment = document.createDocumentFragment();

  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'collection-item';
    li.dataset.id = item.id;

    const isPending = pendingItemIds.has(item.id);
    if (isPending) {
      li.classList.add('pending-sync');
    }

    // Badge catégorie
    const badge = document.createElement('div');
    badge.className = 'item-badge';
    let catClass = 'badge-vinyl';
    let catIcon = '🎵';
    if (item.category === 'Manga') {
      catClass = 'badge-manga';
      catIcon = '📚';
    } else if (item.category === 'Jeu vidéo') {
      catClass = 'badge-game';
      catIcon = '🎮';
    } else if (item.category === 'BD') {
      catClass = 'badge-bd';
      catIcon = '🎨';
    }
    badge.classList.add(catClass);
    badge.textContent = `${catIcon} ${item.category}`;
    li.appendChild(badge);

    // Bouton de suppression
    const btnDelete = document.createElement('button');
    btnDelete.className = 'item-delete-btn';
    btnDelete.type = 'button';
    btnDelete.setAttribute('aria-label', `Supprimer ${item.title}`);
    btnDelete.innerHTML = '&times;';
    btnDelete.addEventListener('click', async () => {
      await deleteItem(item.id);
    });
    li.appendChild(btnDelete);

    // Corps de l'élément
    const body = document.createElement('div');
    body.className = 'item-body';

    const h3 = document.createElement('h3');
    h3.className = 'item-title';
    h3.textContent = item.title;
    body.appendChild(h3);

    if (item.details) {
      const pMeta = document.createElement('p');
      pMeta.className = 'item-meta';
      pMeta.textContent = item.details;
      body.appendChild(pMeta);
    }

    if (item.barcode) {
      const spanCode = document.createElement('span');
      spanCode.className = 'item-code';
      spanCode.textContent = `EAN : ${item.barcode}`;
      body.appendChild(spanCode);
    }

    if (isPending) {
      const pSync = document.createElement('p');
      pSync.className = 'item-sync-status';
      pSync.textContent = '⏳ En attente de synchronisation';
      body.appendChild(pSync);
    }

    li.appendChild(body);
    fragment.appendChild(li);
  }

  elements.collectionList.replaceChildren(fragment);
}

// 5. Ajout d'un objet (Gestion Locale + Outbox)
async function addItem(title, category, barcode, details) {
  const db = await getDB();
  const newItem = {
    title,
    category,
    barcode,
    details,
    createdAt: Date.now(),
  };

  // 1. Sauvegarde locale immédiate
  const localId = await db.add('items', newItem);
  newItem.localId = localId;

  // 2. Ajout dans l'outbox pour synchronisation
  await db.add('outbox', {
    action: 'create',
    payload: newItem,
    timestamp: Date.now(),
  });

  await renderCollection();
  showToast(`✅ "${title}" ajouté à la collection.`);

  // 3. Tenter la synchronisation immédiate ou enregistrer Background Sync
  await requestSync();
}

async function deleteItem(id) {
  const db = await getDB();
  await db.delete('items', id);
  await renderCollection();
  showToast('Objet retiré de la collection.');
}

// 6. Synchronisation de l'Outbox (avec fallback universel)
async function flushOutbox() {
  const db = await getDB();
  const outboxItems = await db.getAll('outbox');

  if (outboxItems.length === 0) return;

  let syncedCount = 0;
  for (const item of outboxItems) {
    try {
      const res = await fetch('https://httpbin.org/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app: 'CollecBox',
          action: item.action,
          data: item.payload,
          syncedAt: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        await db.delete('outbox', item.id);
        syncedCount++;
      }
    } catch (err) {
      console.warn('Échec de synchronisation outbox pour l\'élément', item.id, err);
      // On interrompt la boucle pour réessayer plus tard
      break;
    }
  }

  await renderCollection();
  const remaining = await db.count('outbox');
  if (remaining === 0 && syncedCount > 0) {
    showToast('🌐 Toutes vos créations sont synchronisées avec le serveur !');
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification('CollecBox — Synchronisation terminée 🌐', {
          body: `${syncedCount} objet(s) hors ligne synchronisé(s) avec succès !`,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-64.png',
          tag: 'sync-notification',
        });
      } catch (err) {
        console.debug('Notification push err:', err);
      }
    }
  }
}

async function requestSync() {
  if (!navigator.onLine) {
    showToast('📴 Hors ligne : objet conservé localement, synchronisation en attente.');
    return;
  }

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if ('sync' in reg) {
        // Chromium Background Sync
        await reg.sync.register('sync-items');
        return;
      }
    } catch (err) {
      console.warn('Background sync registration failed:', err);
    }
  }

  // Fallback universel : synchro directe depuis le thread principal
  await flushOutbox();
}

// 7. Surveillance de l'état réseau (Online / Offline)
function updateNetworkStatus() {
  const isOnline = navigator.onLine;
  if (isOnline) {
    document.body.classList.remove('offline');
    elements.networkStatusDot.className = 'status-indicator online';
    elements.networkStatusText.textContent = 'Connecté au réseau — Synchronisation active';
    flushOutbox();
  } else {
    document.body.classList.add('offline');
    elements.networkStatusDot.className = 'status-indicator';
    elements.networkStatusText.textContent = 'Mode hors ligne — Données locales disponibles';
    showToast('📴 Connexion perdue : mode hors ligne activé.');
  }
}

window.addEventListener('online', () => {
  showToast('🌐 Connexion rétablie !');
  updateNetworkStatus();
});

window.addEventListener('offline', updateNetworkStatus);

// 8. Capacité 1 : Lecture de codes-barres (BarcodeDetector + getUserMedia)
let mediaStream = null;
let barcodeScanLoop = null;

async function startBarcodeScanner() {
  elements.scannerFeedback.className = 'scanner-feedback';
  elements.scannerFeedback.textContent = 'Initialisation de la caméra...';
  
  if (elements.scannerModal.showModal) {
    elements.scannerModal.showModal();
  } else {
    elements.scannerModal.hidden = false;
  }

  try {
    // Vérification de getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia non supporté');
    }

    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    elements.scannerVideo.srcObject = mediaStream;
    await elements.scannerVideo.play();

    // Détection de la compatibilité BarcodeDetector
    if ('BarcodeDetector' in window) {
      const formats = ['ean_13', 'ean_8', 'itf', 'qr_code'];
      const barcodeDetector = new window.BarcodeDetector({ formats });

      elements.scannerFeedback.textContent = 'Visez le code-barres (EAN-13, EAN-8) avec la caméra.';

      barcodeScanLoop = setInterval(async () => {
        if (!elements.scannerVideo.videoWidth) return;
        try {
          const barcodes = await barcodeDetector.detect(elements.scannerVideo);
          if (barcodes.length > 0) {
            const detectedCode = barcodes[0].rawValue;
            handleBarcodeSuccess(detectedCode);
          }
        } catch (scanErr) {
          console.debug('Scan frame err:', scanErr);
        }
      }, 350);
    } else {
      elements.scannerFeedback.className = 'scanner-feedback alert';
      elements.scannerFeedback.textContent =
        'Caméra active. BarcodeDetector n\'est pas supporté par ce navigateur (Safari/Firefox). Saisissez le code EAN à la main ci-dessous.';
    }
  } catch (err) {
    console.error('Erreur caméra/scanner :', err);
    stopBarcodeScanner();

    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      showToast('⚠️ Accès caméra refusé. Vous pouvez saisir le code-barres manuellement dans le formulaire.', 6000);
      elements.itemBarcode.focus();
    } else {
      showToast('⚠️ Impossible d\'accéder à la caméra sur cet appareil.', 4000);
    }
  }
}

function handleBarcodeSuccess(code) {
  stopBarcodeScanner();
  elements.itemBarcode.value = code;
  showToast(`🎯 Code-barres scanné avec succès : ${code}`);
  elements.itemBarcode.focus();
}

function stopBarcodeScanner() {
  if (barcodeScanLoop) {
    clearInterval(barcodeScanLoop);
    barcodeScanLoop = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  if (elements.scannerVideo) {
    elements.scannerVideo.srcObject = null;
  }
  if (elements.scannerModal.close) {
    elements.scannerModal.close();
  } else {
    elements.scannerModal.hidden = true;
  }
}

// 9. Capacité 2 : Web Share API
async function shareCollection() {
  const db = await getDB();
  const count = await db.count('items');

  const shareData = {
    title: 'CollecBox — Ma collection culturelle',
    text: `Consultez ma collection sur CollecBox : déjà ${count} vinyle(s), manga(s) et jeu(x) répertoriés !`,
    url: window.location.href,
  };

  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      showToast('Collection partagée avec succès !');
    } catch (err) {
      if (err.name !== 'AbortError') {
        fallbackClipboard(shareData.url);
      }
    }
  } else {
    fallbackClipboard(shareData.url);
  }
}

async function fallbackClipboard(url) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
      showToast('📋 Lien de la collection copié dans le presse-papiers !');
    } else {
      showToast(`Partager ce lien : ${url}`);
    }
  } catch {
    showToast(`Partager ce lien : ${url}`);
  }
}

// 10. Installation PWA (beforeinstallprompt)
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  elements.btnInstall.hidden = false;
});

elements.btnInstall.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast('🎉 Merci d\'avoir installé CollecBox !');
      elements.btnInstall.hidden = true;
      deferredPrompt = null;
    } else {
      showToast('Installation reportée.');
    }
  } catch (err) {
    console.warn('Erreur prompt installation:', err);
    showToast('⚠️ Vous pouvez aussi installer l\'application via le menu du navigateur (⋮ > Installer).');
  }
});

window.addEventListener('appinstalled', () => {
  elements.btnInstall.hidden = true;
  deferredPrompt = null;
  showToast('CollecBox est désormais installée sur votre écran d\'accueil.');
});

// 11. Cycle de vie Service Worker & Bannière de mise à jour
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker enregistré avec le scope :', registration.scope);

      function showUpdateBanner(worker) {
        elements.updateBanner.hidden = false;
        elements.btnUpdate.onclick = () => {
          worker.postMessage({ type: 'SKIP_WAITING' });
        };
      }

      // 1. Si un nouveau Service Worker est déjà en attente
      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdateBanner(registration.waiting);
      }

      // 2. Détection d'un nouveau Service Worker en cours d'installation
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // Nouveau SW prêt et en attente
            showUpdateBanner(newWorker);
          }
        });
      });

      // Si le Service Worker en attente prend le contrôle, rafraîchir
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    } catch (err) {
      console.error('❌ Échec d\'enregistrement du Service Worker :', err);
    }
  });
}

// 11bis. Gestion des Notifications de Synchronisation (Bonus PWA)
function updateNotificationButtonUI() {
  if (!('Notification' in window) || !elements.btnNotif) {
    if (elements.btnNotif) elements.btnNotif.hidden = true;
    return;
  }

  if (Notification.permission === 'granted') {
    elements.btnNotif.classList.remove('btn-outline');
    elements.btnNotif.classList.add('btn-success');
    if (elements.notifLabel) elements.notifLabel.textContent = 'Alertes actives';
    elements.btnNotif.title = 'Les alertes de synchronisation sont actives';
  } else if (Notification.permission === 'denied') {
    elements.btnNotif.classList.remove('btn-success');
    elements.btnNotif.classList.add('btn-outline');
    if (elements.notifLabel) elements.notifLabel.textContent = 'Alertes bloquées';
    elements.btnNotif.title = 'Notifications bloquées dans les paramètres de votre navigateur';
  } else {
    elements.btnNotif.classList.remove('btn-success');
    elements.btnNotif.classList.add('btn-outline');
    if (elements.notifLabel) elements.notifLabel.textContent = 'Alertes de synchro';
    elements.btnNotif.title = 'Cliquez pour activer les alertes de synchronisation hors ligne';
  }
}

async function handleNotificationToggle() {
  if (!('Notification' in window)) {
    showToast('⚠️ Votre navigateur ne supporte pas les notifications.');
    return;
  }

  if (Notification.permission === 'granted') {
    showToast('🔔 Les alertes sont déjà activées.');
    return;
  }

  if (Notification.permission === 'denied') {
    showToast('⚠️ Notifications bloquées dans les paramètres du navigateur.');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    updateNotificationButtonUI();
    if (permission === 'granted') {
      showToast('🔔 Alertes activées ! Vous serez notifié dès qu\'un ajout hors ligne sera synchronisé.');
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification('CollecBox — Alertes actives 🔔', {
          body: 'Vous recevrez une alerte quand vos ajouts hors ligne seront synchronisés.',
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-64.png',
          tag: 'welcome-notification',
        });
      }
    } else {
      showToast('Notifications non activées.');
    }
  } catch (err) {
    console.error('Erreur demande notifications:', err);
  }
}

// 12. Événements des éléments du DOM
elements.btnScan.addEventListener('click', startBarcodeScanner);
elements.btnCloseScanner.addEventListener('click', stopBarcodeScanner);
elements.btnStopScanner.addEventListener('click', stopBarcodeScanner);
elements.btnShare.addEventListener('click', shareCollection);
if (elements.btnNotif) {
  elements.btnNotif.addEventListener('click', handleNotificationToggle);
}

elements.itemForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = elements.itemTitle.value.trim();
  const category = elements.itemCategory.value;
  const barcode = elements.itemBarcode.value.trim();
  const details = elements.itemDetails.value.trim();

  if (!title) return;

  await addItem(title, category, barcode, details);
  elements.itemForm.reset();
  elements.itemTitle.focus();
});

// Initialisation au chargement de la page
window.addEventListener('DOMContentLoaded', () => {
  updateNetworkStatus();
  updateNotificationButtonUI();
  hydrateInitialSeeds();
});
