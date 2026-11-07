# Peak: iPhone-pilot fra Windows og Codespaces

## Status og valgt vej

Forberedelse til #26; opgaven er ikke afsluttet ved merge af denne vejledning.
Peak er opgraderet til **Expo SDK 58**, fordi ejerens installerede Expo Go
rapporterer **client version 58.0.5 / Supported SDK 58.0.0**. Den tidligere
SDK 54-vej passede ikke til denne klient. Versionskonflikten skal løses før
telefonens fortsatte nedbrud kan vurderes; match alene beviser ikke, at et native
nedbrud er rettet.

Officielle kilder og observeret klientversion:

- [SDK 58](https://expo.dev/changelog/sdk-58): SDK 58 understøttes af den nye
  Expo Go. SDK-version i projekt og klient skal matche.
- [Opgraderingsvejledning](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/):
  opgradér trinvist og kontroller kompatible afhængigheder.
- [Fil-API](https://docs.expo.dev/versions/latest/sdk/filesystem/): eksport bruger
  File/Paths; midlertidige filer slettes efter deling eller fejl.
- [Expo-login på iPhone](https://docs.expo.dev/troubleshooting/expo-go-sign-in-required/):
  brug samme Expo-konto i CLI og Expo Go.

Brug den allerede installerede Expo Go-klient, og kontrollér dens Supported SDK.
Der startes ingen betalte builds, køb eller App Store-publicering. En senere egen
native build har separate Apple-/Expo-krav og omkostninger, som skal afklares før
bestilling. Codespaces har egne forbrugsgrænser.

## Før du opdaterer

1. Eksportér eventuelle vigtige eksisterende data fra webversionens Data-side.
2. Bevar samme browserprofil og Codespaces-adresse til webtesten. Et nyt native
   Expo Go-projekt får sine egne data; det overtager ikke Safari-data.
3. Brug fiktive målinger til slette-/fejltests. Eksporten kan ikke importeres endnu.
4. Gem eller commit eventuelle egne kodeændringer, før du henter main. Hvis Git
   melder konflikt, stop og få hjælp; brug ikke reset/clean til at fjerne dem.

## Start i Codespaces

Når forberedelses-PR'en er merged, stop en kørende server med Ctrl+C. Kør:

```sh
git pull --ff-only
node --version
npm ci
npm test
npm run typecheck
npx expo install --check
```

Hvis Node ikke er mindst 22.13 på 22-linjen eller 24.3 på 24-linjen, brug Codespaces' nvm, hvis det er tilgængeligt:

```sh
nvm install
nvm use
```

`.nvmrc` vælger Node 22. Ingen pakker installeres på den lånte Windows-computer;
kommandoerne kører i Codespaces.

Log ind med en Expo-konto i terminalen:

```sh
npx expo login
npx expo whoami
npm run iphone
```

Indtast login/2FA i Expos loginforløb, aldrig i GitHub-opgaver eller chat.
SDK 58 har en ny indbygget tunnel. @expo/ngrok er ikke længere en afhængighed.
Følg CLI-loginforløbet (browserlogin er standard); indtast ikke koder i chat.

På iPhone:

1. Installér/opdatér Expo Go fra App Store.
2. Log ind med samme Expo-konto som i terminalen.
3. Scan terminalens QR-kode med Kamera, og vælg at åbne i Expo Go.
4. Lad Codespaces og serveren køre under testen. Browserens videresendte webadresse
   er ikke den native Expo Go-adresse.

Tunnelen giver en tilgængelig udviklingsadresse; del den ikke offentligt.
Den er en forbindelse til udviklingsserveren, ikke en udgivet selvstændig app.

## Hvis forbindelsen fejler

- Versionsfejl: kontrollér, at main/denne PR er hentet, Expo Go understøtter SDK 58,
  og `npx expo install --check` består. Genstart med `npm run iphone -- --clear`.
- Loginfejl: kontrollér samme Expo-brugernavn i terminal og telefon.
- Port optaget: stop den gamle server, eller brug `npm run iphone -- --port 8087`.
- Tunnel-timeout: stop/genstart serveren, kontrollér internet og
  [Expo-status](https://status.expo.dev/). Ændr ikke antivirus eller
  organisationspolitik på den lånte computer.
- Hvis det fortsat fejler: registrér den konkrete fejl, og afklar en alternativ
  forbindelse. Køb ikke abonnement/Apple-medlemskab som automatisk løsning.
- Rød fejlskærm: gem fejlteksten og testtrinnet uden at dele personlige eksportdata.

Stop serveren med Ctrl+C og stop Codespaces, når du er færdig. Log ud af GitHub
på den lånte computer. Expo CLI kan logges ud med `npx expo logout`.

## Testjournal

Oplyst af ejer: **iOS 27**. Model og præcis OS-version er endnu ikke verificeret.
Ejer har oplyst Expo Go 58.0.5 / Supported SDK 58.0.0. Udfyld før native resultat registreres:

| Felt | Værdi |
| --- | --- |
| Dato og tester | Afventer |
| iPhone-model | Afventer |
| iOS-version inkl. patch | iOS 27 oplyst; præcis version afventer |
| Expo Go-version/build | 58.0.5 / Supported SDK 58.0.0, oplyst af ejer |
| Peak Git-commit | `git rev-parse HEAD` i det Codespace, der testes |
| Node-version | `node --version` |
| Kørsel | Native Expo Go eller Safari/web; må ikke sammenblandes |
| Netværk/forbindelse | Tunnel og eventuelle fejl |

### Kontrolleret i udviklingsmiljøet

Kandidatændringen til SDK 58: se PR-valideringen for de udførte automatiske
kontroller og browserregressioner. Fysisk iPhone-afprøvning afventer.

Historisk: SDK 54-tunnelen blev forbundet i ejerens Codespace, men Expo Go
lukkede ved åbning. Det blev derefter konstateret, at klienten var 58.0.5 og
kun understøttede SDK 58. Den tidligere SDK 54-test dokumenterer derfor hverken
SDK 58-forbindelse eller en fungerende native app.

### Fysisk iPhone: afventer ejerens afprøvning

- [ ] Første brug: profil er ikke gemt automatisk.
- [ ] Gem profil; ændr mål/aktivitet; ugyldig vægt erstatter ikke gemte værdier.
- [ ] Gem ugeplan; ændring påvirker Today efter gemning.
- [ ] Tilføj vægt i dag og på en tidligere dato; fremtid/ugyldig dato afvises.
- [ ] Redigér vægt/dato; annullér en redigering; kontrollér samme måling.
- [ ] Annullér sletning; bekræft en sletning; kontrollér Today.
- [ ] Luk Expo Go helt og genåbn samme Peak-projekt: gemte data er bevaret.
- [ ] Eksportér til Arkiver; åbn JSON og kontrollér data/version/tidspunkt.
- [ ] Annullér deling; appen påstår ikke, at en fil blev gemt.
- [ ] Annullér nulstilling: data bevares.
- [ ] Nulstil med fiktive data; genstart: første brug og tom historik.
- [ ] Tastatur: alle relevante felter og gemmeknapper kan nås uden overlap.
- [ ] Scroll, notch/safe areas, tekst og valgte indstillinger fungerer på telefonen.
- [ ] Dagskifte: Today og ugeplan bruger den nye dato uden at slette historik.
- [ ] Lås telefonen / lad appen være i baggrunden til næste dag; genåbn og kontrollér.
- [ ] Gemme-/læsefejl og genforsøg er kontrolleret i en separat testopsætning,
  ikke ved at fylde telefonens lager eller ødelægge rigtige data.

Browser-fejlinjektion og kontrollerede unit tests dækker allerede fejlscenarier;
det er ikke bevis for en fejltest på fysisk iPhone.

### Samlet pilot

Brug appen personligt i mindst to uger og registrér problemer i #26 eller små,
linkede fejl-opgaver: trin, forventning, faktisk resultat, platform, commit og
alvor. Brug ingen personlige dataeksporter som offentlige vedhæftninger.

Fase 1 kan afsluttes, når native checklisten er gennemført, pilotperioden er
observeret, og der ikke er kendte datatabsfejl. Ikke gennemførte tests og
begrænsninger skal stå eksplicit; en JS-bundle er ikke en kompileret iOS-app,
og Safari-kørsel er ikke native verifikation.
