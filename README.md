# After She Left

**Turn what hurt into who you become.** An Android app (React Native / Expo) to record your
mistakes and the rules you learned from them, get reminded at the moments and places where you'd
repeat them, build habits the *Atomic Habits* way, keep goals written as if already achieved, and
start each day with a short prayer written from your own records.

| Today | Habits | Lessons | Prayer | Pricing |
|---|---|---|---|---|
| ![Today](docs/screenshots/today.png) | ![Habits](docs/screenshots/habits.png) | ![Lessons](docs/screenshots/lessons.png) | ![Prayer](docs/screenshots/prayer.png) | ![Pricing](docs/screenshots/pricing.png) |

The full product and engineering design is in **[BLUEPRINT.md](BLUEPRINT.md)**.

## Features

- **Lessons**: a 5-step wizard (what happened → why → if–then solution → circumstances → review),
  time and place reminders, a check-in flow with breathing for urges, and spaced-review flashcards.
- **Habits**: weekly targets with flexible timing, an auto-planner, beginner mode, two-minute
  versions, habit stacking, implementation intentions, rewards, the Goldilocks rule, "never miss
  twice", and quote nudges that never repeat.
- **Dashboard**: today's prayer, **rings for the last 7 days** (done/planned per day), today's
  checklist, lessons for today, and your goal affirmation.
- **Habit viewer**: only *Previous · Now · Next*, each with a last-7-days ring and an expand arrow
  (Week or Month view). All other habits sit behind one "Other habits" button.
- **Goals**: specific date, time, place and measure, an "already achieved" affirmation, milestones
  and linked habits. Only real dates can be picked (29 Feb exists only in leap years).
- **Daily prayer**: secular affirmation by default (or spiritual / your faith), built from your
  lessons, goals and habits. Three engines, cheapest and most private first:
  - Free plan: composed on the phone ($0, nothing sent).
  - Premium on supported phones (Pixel 10, Galaxy S24/S25…): written by **Gemini Nano** on the
    phone ($0, nothing sent).
  - Premium on other phones: written by **Claude Haiku 4.5** in the cloud (about $0.004 a prayer).

  Any failure falls back to the next engine, so there is always a prayer.
- **Pricing**: 14-day free trial → **$20/month** Premium, or free with ads and limits (5 habits,
  10 goals, 25 lessons, 1 place reminder, 3 scheduled reminders, prayers composed on the phone).
- **Privacy**: fingerprint/PIN lock, hide from recents and screenshots, private notification text,
  local-first storage, JSON export.
- **Modern UI**: a dark-first "Calm night" design system with a light theme. Every component is
  shown on **Me → Design system**.

## Run it

Requirements: Node 20+ and npm. The app works with **no configuration** (everything stays on the
device, with template prayers, test billing and placeholder ads).

```bash
npm install
npx expo start          # press "a" for an Android emulator/device, or "w" for the web
```

On the welcome screen, **Explore with sample data** loads realistic examples.

| Command | What it does |
|---|---|
| `npm test` | Jest unit and component tests |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint (incl. React Compiler rules) |
| `npm run export:web` | Production web build in `dist/` |

### Android builds

Notifications, geofences, biometrics, AdMob, RevenueCat and Gemini Nano need a **development
build** (they are not all in Expo Go):

```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile development   # dev client APK
npx eas-cli@latest build -p android --profile preview       # installable APK
npx eas-cli@latest build -p android --profile production    # Play Store AAB
```

**Gemini Nano** is a local Expo module in `modules/gemini-nano` (autolinked). It needs
`minSdkVersion 26`, set in `app.json` through `expo-build-properties`. Test it with a development
build on a supported phone (Pixel 10, Galaxy S24/S25 and others with Android AICore): sign in to a
trial or Premium account, open **Me → Daily prayer** and check that it says *On this phone (Gemini
Nano)*. The first download happens in the background over Wi-Fi. On other phones, the web and
Expo Go, the module reports *unavailable* and the cloud or template engine is used.

## Optional services

Copy `.env.example` to `.env.local` and fill in what you use. Each service turns on independently.

### Firebase (sign-in, cloud sync, AI prayers, server-side trial)

1. Create a Firebase project. Enable **Authentication → Email/Password** and **Firestore**.
2. Add a Web app and copy its config into the `EXPO_PUBLIC_FIREBASE_*` variables.
3. Deploy rules and functions:

   ```bash
   npm i -g firebase-tools && firebase login
   cp .firebaserc.example .firebaserc        # set your project id
   firebase functions:secrets:set ANTHROPIC_API_KEY
   firebase functions:secrets:set REVENUECAT_WEBHOOK_AUTH
   cd functions && npm install && npm test && cd ..
   firebase deploy --only firestore:rules,functions
   ```

Functions: `generateDailyPrayer` (Claude `claude-haiku-4-5`, Premium only, quota enforced on the server),
`onUserCreated` (starts the 14-day trial), `deleteAccount`, `revenuecatWebhook`.

### RevenueCat ($20/month subscription)

1. In Google Play Console create a subscription with a **monthly base plan at $20** (set local
   prices as needed).
2. In RevenueCat: add the Play app, an entitlement `premium`, and an offering whose monthly package
   uses that product. Put the public Android SDK key in `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
3. Add a webhook to `https://<region>-<project>.cloudfunctions.net/revenuecatWebhook` with the same
   Authorization value you stored in `REVENUECAT_WEBHOOK_AUTH`.

### AdMob (free tier ads)

Replace the Google **test** app ID in `app.json` (`react-native-google-mobile-ads` plugin) with
yours, and set `EXPO_PUBLIC_ADMOB_BANNER_ANDROID` / `EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID`.
Development builds always use Google's test ads.

## Project structure

```
src/app         routes (expo-router)          src/domain     pure logic + tests
src/ui          design-system components       src/store      zustand store, hooks, sample data
src/features    screen components             src/services   notifications, geofence, lock, billing, ads, sync, prayer, onDeviceAi
functions/      Firebase Cloud Functions       modules/       local Expo module: gemini-nano
docs/           screenshots
```
