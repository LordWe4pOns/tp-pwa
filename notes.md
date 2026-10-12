# CollecBox — Gestionnaire de collection (Vinyles, Mangas, Jeux vidéo, BD)

> Inventaire nomade pour passionnés et collectionneurs de biens culturels.
> 100% utilisable hors ligne · Progressive Web App · M2 Informatique 2026.

## Présentation

CollecBox est un gestionnaire d'inventaire personnel conçu pour répertorier vos vinyles, mangas, bandes dessinées et jeux vidéo.
Grâce à une conception **Local-First**, l'application fonctionne parfaitement sans réseau (en convention, en brocante ou en voyage).
Vos ajouts sont conservés localement dans le navigateur (IndexedDB) et synchronisés dès qu'une connexion Internet redevient disponible.

---

## Objets d'exemple en vitrine publique

### 1. Random Access Memories
- **Catégorie** : 🎵 Vinyle
- **Artiste** : Daft Punk
- **Format** : Double 33T (2013)
- **Code-barres EAN** : 888837168618
- **Statut** : En collection

### 2. One Piece — Tome 1 : Romance Dawn
- **Catégorie** : 📚 Manga
- **Auteur** : Eiichiro Oda
- **Édition** : Éditions Glénat (Sens de lecture original)
- **Code-barres EAN** : 9782723488525
- **Statut** : En collection

### 3. The Legend of Zelda: Tears of the Kingdom
- **Catégorie** : 🎮 Jeu vidéo
- **Plateforme** : Nintendo Switch
- **Édition** : Standard (2023)
- **Code-barres EAN** : 0045496478957
- **Statut** : En collection

---

## Fonctionnalités principales
- **Numérisation rapide** : Détection automatique des codes-barres par caméra (BarcodeDetector API).
- **Mode hors ligne garanti** : Consultation et ajout sans aucune interruption de service.
- **Synchronisation transparente** : File d'attente (Outbox) et reprise automatique via Background Sync.
- **Partage simplifié** : Export direct vers vos applications favorites grâce à la Web Share API.
