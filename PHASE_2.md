# Fase 2: personlige og forklarlige anbefalinger

Retning bekræftet af ejer 7. november 2026. Målgruppen er fortsat motionister,
der kombinerer styrke og endurance. Fase 1-piloten fortsætter i #26.

## Resultatet for brugeren

Brugeren skal kunne se:

- Hvad dagens energi-/makromål er.
- Hvilken planlagt træning og observeret udvikling der påvirker dem.
- Hvorfor de afviger fra tidligere mål.
- Hvilke oplysninger der mangler, og hvornår justeringer ikke kan underbygges.
- Hvordan egne valg, justeringstilstand og låste mål påvirker resultatet.

Vi starter med manuel registrering og lokale data. AI-chat, restitution fra
wearables, fødevaredatabase og egne komplette træningsmoduler kommer senere.

## Leverancer

| Opgave | Leverance | Afhænger af |
| --- | --- | --- |
| [#38](https://github.com/beringt/Peak-app/issues/38) | Præcis beregningsspecifikation og forventede referenceeksempler | Nuværende kode og produktvision |
| [#39](https://github.com/beringt/Peak-app/issues/39) | Relevante profil-/målinput, validering og versioneret migration | Godkendte relevante regler i #38 |
| [#40](https://github.com/beringt/Peak-app/issues/40) | Varighed/intensitet og lange træningspas i ugeplanen | #38; koordinér migration med #39 |
| [#41](https://github.com/beringt/Peak-app/issues/41) | Robust vægttrend med datakrav og manglende-data-tilstande | #38 |
| [#42](https://github.com/beringt/Peak-app/issues/42) | Ren, versioneret daglig anbefalingsmotor | #38–#41 |
| [#43](https://github.com/beringt/Peak-app/issues/43) | Gemte anbefalinger med input, regelversion og begrundelser | #42 |
| [#44](https://github.com/beringt/Peak-app/issues/44) | Ugentlig justering, tilstande og låste mål | #38, #41–#43 |
| [#45](https://github.com/beringt/Peak-app/issues/45) | Forståelig Today-visning og samlet telefonafprøvning | #39–#44 |

## Første opgave: #38

Leverancen er en beregningsspecifikation med eksplicitte formler, enheder,
afrunding, grænser, datakrav, genberegningsregler og forventede eksempler.
Den beskriver også de oplysninger, som skal indsamles, og migrationsbehovet.

Følgende skal afklares før den tilhørende implementering:

1. Personlig energibasis og fallback ved manglende oplysninger.
2. Mål/ændringsrate og betydningen af konservativ, neutral og aggressiv tilstand.
3. Træningsbelastning og skelnen mellem aktivitet i baselinen og ekstra træning.
4. Makrofordeling, forberedelse til lange pas og konflikter mellem låste værdier.
5. Vægtaggregation pr. dag, glidende trend, minimumsdata og gamle/manglende data.
6. Tidspunkt, grænser og brugerens kontrol med ugentlige justeringer.
7. Hvordan genforsøg/genstart undgår at anvende samme ugejustering flere gange.
8. Hvilke input og begrundelser der gemmes for at forklare en historisk anbefaling.

Forslag og uafklarede valg skal fremgå tydeligt. Ejer gennemgår det konkrete
forslag, før afhængige opgaver ændrer appens anbefalinger. Nye ernærings- og
træningsregler skal have kilder; estimater må ikke fremstilles som dokumenteret
effekt for den enkelte. Behov for faglig vurdering før bred brug skal beskrives.

## Tekniske rammer

- Fortsæt React Native/Expo/TypeScript og den eksisterende skærmstruktur.
- Bevar rå data og gamle anbefalinger ved migrationer; fejl må ikke nulstille dem.
- Rene beregningsfunktioner får dato og regelversion eksplicit som input.
- Manglende registrering er ikke nul indtag, nul træning eller god restitution.
- Gem strukturerede begrundelser fra faktisk anvendte input.
- Daglig genberegning og ugentlig justering er forskellige operationer.
- Nye regler får nye referenceeksempler; ret ikke formler alene for at få en test grøn.
- Eksport/nulstilling og genstart skal fortsat fungere, når datamodellen udvides.

## Afslutning af fasen

Fasen er færdig, når de aftalte referenceeksempler består, historik kan forklares,
brugeren kan styre justeringer/låse, og de samlede forløb er prøvet på iPhone.
Personlig brug skal afdække friktion og uventede justeringer; kendte datatabs-
eller beregningsfejl blokerer afslutning. Et antal grønne tests er ikke alene
dokumentation for anbefalingernes individuelle effekt.

Dette dokument er en leveranceplan. Det aktiverer ingen nye formler eller
automatisk justering i den nuværende app.
