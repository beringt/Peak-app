# Peak

Expo / React Native app for training plans, weight history and daily nutrition targets.

Use Node 22 (minimum supported: 20.19.4).

```sh
npm ci
npm test
npm run typecheck
npm run web
```

For a physical iPhone from Windows/Codespaces, see [IPHONE_PILOT.md](IPHONE_PILOT.md).
Run `npm run iphone` to start the Expo Go tunnel after signing in.

Browser and native data are separate. Export existing data before changing app
installations, browsers or Codespaces URLs. Export currently has no import counterpart.

The [roadmap](ROADMAP.md) and [local data contract](LOCAL_DATA.md) describe scope.
Issue #26 stays open until the physical-device checklist and multiweek pilot pass.
