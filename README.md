# Sun Path Card (FR)

Carte Home Assistant 2 en 1 : **soleil** le jour (ciel dynamique, arc de course, azimut, élévation, prochains événements) et **lune** la nuit, dans l'esprit de lunar-phase-card (phase, illumination, âge, distance, altitude, azimut, lever/coucher, onglets Horizon et Calendrier). Thème clair/sombre automatique, éditeur visuel, textes en français.

## Installation (HACS)
1. HACS → ⋮ → *Dépôts personnalisés* → `https://github.com/Johan854/sun-path-card`, catégorie **Tableau de bord**.
2. Installer, puis recharger le navigateur.

## Exemple
```yaml
type: custom:sun-path-card
mode: both            # sun | moon | both (soleil le jour, lune la nuit)
sun_entity: sun.sun
azimuth_entity: sensor.sun_solar_azimuth
elevation_entity: sensor.sun_solar_elevation
rising_entity: binary_sensor.sun_solar_rising
dawn_entity: sensor.sun_next_dawn
sunrise_entity: sensor.sun_next_rising
noon_entity: sensor.sun_next_noon
sunset_entity: sensor.sun_next_setting
dusk_entity: sensor.sun_next_dusk
midnight_entity: sensor.sun_next_midnight
```
Options lune : `moon_style` (`real` = photos, par défaut ; `drawn` = dessinée), `moon_rotate` (oriente la lune comme dans le ciel), `moon_position` (left/right), `default_view` (base/horizon/calendar), `moon_title`, `hide_starfield`, `hide_buttons`, `latitude`/`longitude` (sinon ceux de Home Assistant).
La lune est calculée dans la carte (algorithmes de SunCalc) : aucun capteur lunaire n'est nécessaire.

## Crédits
Les 31 photos de lune du dossier `moon_pic` viennent de [lunar-phase-card](https://github.com/ngocjohn/lunar-phase-card) de Viet Ngoc (licence MIT). Elles sont chargées depuis ce dépôt via jsDelivr ; en cas d'échec, depuis le dépôt d'origine, puis la carte revient à la lune dessinée. Les calculs astronomiques s'inspirent de SunCalc (Vladimir Agafonkin, BSD-2).

## Apparence : nuance de couleur

Dans l'éditeur visuel, à côté du thème :

| Option | Valeurs |
|---|---|
| `nuance` | `theme` (par défaut), `braise`, `ocean`, `lagon`, `foret`, `lavande`, `framboise`, `ambre`, `ardoise`, `perso` |
| `nuance_perso` | Couleur au choix (sélecteur de couleur), utilisée avec `nuance: perso` |
| `intensite` | De `0` (neutre) à `2` (très coloré), `1` par défaut |

La nuance teinte le dégradé de fond (et la couleur d'accent quand la carte en a une). Les couleurs d'état (vert, orange, rouge…) ne changent pas.

**Une seule nuance pour toutes les cartes Johan854** : laisse `nuance: theme` et ajoute à ton thème Home Assistant :

```yaml
carte-nuance: "#2f8fd8"
```

Sans cette ligne, `nuance: theme` garde les couleurs d'origine de la carte.

## Historique des versions

- **1.3.0** : nuance de couleur au choix (8 nuances, couleur personnalisée, intensité, ou nuance commune via `carte-nuance` dans le thème).
