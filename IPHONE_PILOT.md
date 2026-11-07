# Peak: iPhone-pilot fra Windows og Codespaces

## Status og valgt vej

Forberedelse til #26; opgaven er ikke afsluttet ved merge af denne vejledning.
Vi vælger Expo SDK 54 og Expo Go fra App Store til en afgrænset personlig pilot.
Det er en kompatibilitetsopgradering fra SDK 53, ikke en opgradering til seneste
SDK eller en produktionsdistribution.

Officiel Expo-vejledning kontrolleret 7. november 2026:

- [Expo Go-versioner](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/):
  App Store-udgaven understøtter SDK 54. SDK 53 passer ikke til den.
- [SDK 54-ændringer](https://expo.dev/changelog/sdk-54):
  React Native 0.81 / React 19.1, Node mindst 20.19.4 og eksisterende fil-API via
  `expo-file-system/legacy`.
- [Tunnel](https://docs.expo.dev/more/expo-cli/#tunneling):
  Expo CLI kan bruge ngrok, så telefon og Codespace ikke behøver samme lokale net.
- [Expo-login på iPhone](https://docs.expo.dev/troubleshooting/expo-go-sign-in-required/):
  brug samme Expo-konto i CLI og Expo Go.

Denne App Store/Expo Go-vej kræver ikke køb af Apple Developer-medlemskab.
En senere egen iOS-build/TestFlight-vej kræver særskilt afklaring af medlemskab og
eventuelle Expo-buildomkostninger. Ingen build, betaling eller publicering er startet.
Codespaces har egne forbrugsgrænser. Stop, hvis et trin kræver en betaling.

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

Hvis Node er for gammel, brug Codespaces' nvm, hvis det er tilgængeligt:

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
`@expo/ngrok` er en lokal udviklingsafhængighed, så global installation er unødvendig.

På iPhone:

1. Installér/opdatér Expo Go fra App Store.
2. Log ind med samme Expo-konto som i terminalen.
3. Scan terminalens QR-kode med Kamera, og vælg at åbne i Expo Go.
4. Lad Codespaces og serveren køre under testen. Browserens videresendte webadresse
   er ikke den native Expo Go-adresse.

Tunnelen giver en tilgængelig udviklingsadresse; del den ikke offentligt.
Den er en forbindelse til udviklingsserveren, ikke en udgivet selvstændig app.

## Hvis forbindelsen fejler

- Versionsfejl: kontrollér, at main/denne PR er hentet, Expo Go bruger SDK 54,
  og `npx expo install --check` består. Genstart med `npm run iphone -- --clear`.
- Loginfejl: kontrollér samme Expo-brugernavn i terminal og telefon.
- Port optaget: stop den gamle server, eller brug `npm run iphone -- --port 8087`.
- Tunnel-timeout: stop/genstart serveren, kontrollér internet og
  [ngrok-status](https://status.ngrok.com/). Ændr ikke antivirus eller
  organisationspolitik på den lånte computer.
- Hvis det fortsat fejler: registrér den konkrete fejl, og afklar en alternativ
  forbindelse. Køb ikke abonnement/Apple-medlemskab som automatisk løsning.
- Rød fejlskærm: gem fejlteksten og testtrinnet uden at dele personlige eksportdata.

Stop serveren med Ctrl+C og stop Codespaces, når du er færdig. Log ud af GitHub
på den lånte computer. Expo CLI kan logges ud med `npx expo logout`.

## Testjournal

Oplyst af ejer: **iOS 27**. Model, præcis OS-version og Expo Go-build er endnu
ikke verificeret. Udfyld før native resultat registreres:

| Felt | Værdi |
| --- | --- |
| Dato og tester | Afventer |
| iPhone-model | Afventer |
| iOS-version inkl. patch | iOS 27 oplyst; præcis version afventer |
| Expo Go-version/build | Afventer |
| Peak Git-commit | `git rev-parse HEAD` i det Codespace, der testes |
| Node-version | `node --version` |
| Kørsel | Native Expo Go eller Safari/web; må ikke sammenblandes |
| Netværk/forbindelse | Tunnel og eventuelle fejl |

### Kontrolleret i udviklingsmiljøet

7. november 2026, Linux / Node 24.22.1, kandidatændringen til SDK 54:

- Ren installation via `npm ci` består.
- 180 tests og TypeScript-kontrol består.
- Expo Doctor: 18/18 kontroller består.
- iOS Hermes-bundle og webeksport lykkes. iOS-bundlen er ikke en signeret app.
- Chromium ved 320 pixels: profil, valgte indstillinger, ugyldigt input,
  skærmskift/genindlæsning, vægtredigering/sletning, ugeplan, dagskifte,
  JSON-download, nulstilling og kontrollerede læse-/skrivefejl består.
- Native eksport testes med mocks; fysisk deling og iOS-tastatur er ikke afprøvet.
- `npm run iphone -- --port 8087` starter Metro, men tunnelen ender med
  `ngrok tunnel took too long to connect` i dette miljø. Tunnel i ejerens
  Codespace og åbning på telefonen afventer. Det er en uafklaret forbindelsesblokering,
  ikke en bestået native test.

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
