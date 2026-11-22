# Kairo — personal mission control

Own every hour. Kairo is a personal productivity app (separate from the ORBIT AI business product) built around a fixed 5:00 AM – 9:30 PM routine. It covers Today, Focus, Business, Projects and Insights, plus study, reading, trading, manifestation, journal, content, research and recurring habits.

Design: [Figma — Kairo Personal Mission Control](https://www.figma.com/design/uxspy5bYgh407CQdea3kgK)

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # schedule + recurrence engine tests
npm run build      # production PWA in dist/
```

## Install on Android (POCO C55)

**Quick (PWA):** deploy `dist/` to any HTTPS host, open it in Chrome on the phone, then use ⋮ → *Add to Home screen*. It works offline. Notifications only fire while Kairo is open.

**Full (native APK, alarm-style reminders while closed):** needs Android Studio on a computer.

```bash
npm run cap:sync          # build web + copy into android/
npx cap open android      # opens Android Studio → Run ▶ on the phone (USB debugging on)
```

On the phone, allow notifications. On Android 12+, also allow *Alarms & reminders* for Kairo, and turn off MIUI battery optimisation for it so reminders fire on time.

## Health

- **Meal photos (Groq or Grok):** open More → Settings → *Meal photo AI* and paste a Groq key (`gsk_…`, Qwen 3.8 vision, free tier) or an xAI Grok key (`xai-…`); the provider is detected from the key. The key is stored only on that phone (not in backups, GitHub or Vercel). Photos go through `/api/analyze-meal`, a Vercel relay that forwards them to that provider and stores nothing.
- **Calorie targets:** Health → tap the goal chip → enter weight, height and age. Targets are Mifflin-St Jeor × 1.55 plus a +300 kcal (lean bulk) or +500 kcal (bulk) surplus.
- **Sleep (Android app only):** build the APK (below), open Health → Sleep → *Open settings*, then allow **Usage access** for Kairo. Each morning Kairo reads screen on/off history from 9:30 PM to noon and detects your sleep, wake-ups and score. Nothing leaves the phone.

## Data

- Offline-first: everything is stored on the device in IndexedDB. No account and no server.
- Settings → Backup & restore exports and imports a full JSON backup. Use it to move data from an old app or another phone.
- Nothing is pre-filled: business numbers, history and streaks start at zero and come only from what you record.
