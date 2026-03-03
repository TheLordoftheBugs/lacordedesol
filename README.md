# lacordedesol
Accordeur & carte des positions de contrebasse — application web mobile.

---

## Changelog

### v1.4
- Sillet rétabli dans sa forme originale (barre fine 24 px, lettre de corde)
- Suppression de l'explication sur les demi-tons dans le panneau détail

### v1.3
- Canvas du manche élargi (130 → 180 px) sans modifier la hauteur
- Chaque note affiche désormais son nom anglais (C D E F G...) en plus du solfège français (Do Ré Mi...)
- Suppression des sections "Doigtés" et "Repère de distance" du panneau détail
- Suppression des repères de distance "0 cm — tête de manche" dans la zone sillet

### v1.2
- Zone sillet agrandie à la moitié du canvas total (576 px)
- Affichage de la note à vide, de la fréquence et d'un cercle "O" dans la zone sillet
- La zone sillet change dynamiquement selon la corde sélectionnée

### v1.1
- Remplacement du timestamp de build (date/heure) par un numéro de version incrémental

---

## Historique des commits

| Commit | Description |
|--------|-------------|
| `75c56fd` | v1.3 — canvas plus large, noms EN, suppression sections distance/doigtés |
| `83b80c3` | v1.2 — sillet zone prend la moitié du canvas |
| `78e6bda` | v1.1 — numéro de version à la place de la date |
| `fe627f6` | Fix : alignement boutons mode et sélecteur Hz à 32 px |
| `86ca495` | Ajout du stamp de build sous le bouton micro |
| `f56bb1b` | UI : alignement hauteur dropdown, texte boutons cordes agrandi |
| `8e96e17` | UI : boutons cordes plus grands + dropdown stylisé |
| `66a1ed5` | Boutons cordes : chiffres romains + noms de notes bilingues |
| `b6af771` | Remplacement des boutons Hz par un select 438–450 Hz |
| `2ca1f20` | Suppression du setup Capacitor — focus web app |
| `c8a9052` | Ajout du setup Capacitor (iOS/Android) |
| `d09ba90` | MVP complet : accordeur + carte des positions |
| `f949902` | Initial commit |
