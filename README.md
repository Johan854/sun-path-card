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
