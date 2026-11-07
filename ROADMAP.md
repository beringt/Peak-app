# Peak: produktretning og roadmap

Plan vedtaget 7. november 2026. Denne roadmap afløser faseinddelingen i den oprindelige vision; visionens funktioner bevares som langsigtede muligheder.

## Produkt og første målgruppe

Peak forbinder træningsplan, kost, vægtudvikling og restitution og giver konkrete, forklarlige daglige anbefalinger.

Første målgruppe er motionister, der kombinerer styrke og endurance. iPhone er første native platform; web bevares som udviklings- og afprøvningsflade.

Kerneforløb: planlæg ugen → få dagens mål → registrér resultatet → forstå næste justering.

Vi udvider efter faktisk brug. At erstatte MyFitnessPal, Strong og andre apps er en langsigtet ambition; hvert modul skal først løse en afgrænset opgave godt.

## Nuværende fundament

- Expo/React Native/TypeScript med Today, Profile, Training og Weight.
- Enkel regelmotor for kalorier/makroer, træningstype og vægttrend.
- 28 automatiske tests samt TypeScript-kontrol.
- Manuel webafprøvning; endnu ikke verificeret som native iPhone-app.
- Data ligger i hukommelsen og forsvinder ved genstart.
- Ingen konti, backend, sundhedsimport eller AI-service.

## Leverancefaser

### 1. Brugbar daglig app

Permanent lokal lagring, tydelig profilopsætning, redigerbar vægthistorik, rullende ugeplan, eksport/nulstilling og iPhone-afprøvning.

Færdig når en personlig pilot over flere uger viser, at data bevares, historik fungerer og daglige forløb er brugbare. En merged PR er ikke alene dokumentation for pilot eller native verifikation.

### 2. Forklarlige, personlige anbefalinger

Før implementering: skriv algoritmespecifikation med præcise input, parametre, datakrav, justeringshyppighed, grænser og testscenarier.

Udvid derefter onboarding, træningsvarighed/intensitet, vægttrend over tid, ugentlig justering og makroperiodisering. Tilføj begrundelser, brugerens justeringstilstand og låste mål med eksplicit håndtering af konflikter.

Gem anbefalingens dato, input, resultat, regelversion og begrundelser. Håndtér manglende data synligt; vis ikke en opdigtet sikkerhedsscore.

Færdig når kendte brugerscenarier giver kontrollerede resultater, og brugeren kan forstå og styre ændringerne. Faglig vurdering skal indgå før bred anvendelse af nye kost-/restitutionsregler.

### 3. Sammenhold plan og virkelighed

Registrér faktisk træning, samlet dagligt energi-/makroindtag og enkel manuel søvn/restitution. Vis en enkel ugeoversigt over plan, registreringer og udvikling.

Ingen fuld fødevaredatabase i denne fase. Manglende ernæringsregistrering må ikke behandles som nul indtag.

Færdig når brugeren kan gennemføre og evaluere en uge uden eksterne datakilder.

### 4. Sundhedsdata på iPhone

Afklar native teknik og tilladelser; byg HealthKit-import i små leverancer med kilde, enhed, tidspunkt og datakvalitet. Begynd med et begrænset datasæt, før søvn/HRV/RHR udvides.

Deduplicér data, håndtér tilbagekaldte tilladelser og delvis historik, og bevar manuel fallback. Forskellige HRV-målemetoder må ikke sammenblandes ukritisk.

Færdig når import og anbefalinger er afprøvet på fysisk iPhone med både eksisterende og manglende data.

### 5. Konti, synkronisering og lukket beta

Én samlet backend som udgangspunkt; login, adgangskontrol, cloud-synkronisering, konfliktregler, driftsindsigt samt eksport/sletning på tværs af lagring.

Afklar databeskyttelse, samtykker, opbevaring og leverandører før upload af sundhedsdata. Lokal eksport/sletning er ikke i sig selv fuld GDPR-compliance.

Færdig når en lille ekstern beta fungerer stabilt. Den oprindelige ambition om 20–50 brugere i fire uger er et senere mål, ikke første test.

### 6. Eget styrkemodul

Øvelser, programmer, sæt/reps/vægt og historik først; derefter enkle, forklarlige progressioner og deload-forslag. Afprøv betjening under træning.

Færdig når målgruppen kan gennemføre sit styrkeforløb i Peak og bruge data i anbefalingerne.

### 7. Ernæringslogging

Egne fødevarer, favoritter, måltider og opskrifter først. Undersøg databasekilder, licens, geografisk dækning og datakvalitet før integration af produktdatabase/stregkoder.

Færdig når daglig logging er hurtig og registreringer kan kontrolleres. Scanning alene leverer ikke korrekte produktdata.

### 8. Endurance og udvalgte integrationer

Sportspecifikke planer, workouts og progression bygges gradvist. Prioritér import og planlægning før egen avanceret GPS-/urregistrering. Undersøg hver integrations faktiske API-adgang og vilkår før løfter om understøttelse.

Android/Health Connect prioriteres efter iPhone-validering og efterspørgsel. Direkte integrationer vurderes enkeltvis.

### 9. Coach/team og avancerede funktioner

Coachfunktioner kræver selvstændige roller, samtykker og adgangsregler. AI-formulering af forklaringer skal bygge på den strukturerede regelmotor. ML, biomarkører og avancerede sammenhængsanalyser kræver særskilt datagrundlag, faglig vurdering og produktbeslutning.

## Fase 1: rækkefølge og GitHub-opgaver

1. [#20: Versionerede data og lagringsgrænse](https://github.com/beringt/Peak-app/issues/20).
2. [#21: Permanent lokal lagring](https://github.com/beringt/Peak-app/issues/21), afhænger af #20.
3. [#22: Første brug og profil](https://github.com/beringt/Peak-app/issues/22), afhænger af #21.
4. [#23: Daterede vægtmålinger, redigering og sletning](https://github.com/beringt/Peak-app/issues/23), afhænger af #21.
5. [#24: Rullende ugeplan med historik](https://github.com/beringt/Peak-app/issues/24), afhænger af #21.
6. [#25: Eksport og nulstilling](https://github.com/beringt/Peak-app/issues/25), afhænger af #21.
7. [#26: Native iPhone og samlet pilot](https://github.com/beringt/Peak-app/issues/26), afhænger af #21–#25.

iPhone-distributionsmuligheder og eventuelle omkostninger kan undersøges tidligt. Køb eller betalte tjenester kræver særskilt accept.

## Arbejdsform

Små issues og fokuserede pull requests mod main; ejer merger. Opdater opgaven ved afklarede scopeændringer. Bevar eksisterende skærmstruktur og ændr arkitektur/dependencies kun ved et konkret behov.

Hver fase har produktmål, acceptkriterier, passende tests og observeret brugerafprøvning. Skriv detaljerede opgaver for den næste fase frem for hele visionen på én gang.

Ingen faste leveringsdatoer endnu: datakilder, platformskrav og faktisk brug skal afklare omfanget. Appens beregninger er foreløbige regler; de eksisterende tests dokumenterer implementeringen, ikke individuel effekt.
