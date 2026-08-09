# Laystra mobile

Expo (React Native + TypeScript) app for Laystra. See the repo root [`CLAUDE.md`](../CLAUDE.md) for project scope and architecture.

## Setup

```
npm install
cp .env.example .env
```

Edit `.env` and set `EXPO_PUBLIC_API_URL` to your machine's **LAN IP** (not `localhost`) plus the backend port, e.g. `http://192.168.1.129:8000`. The phone can't reach `localhost` — that resolves to the phone itself, not your machine. Find your LAN IP with `ipconfig` (Windows) if it changes.

## Run

With the [backend](../backend/README.md) running on the same machine:

```
npx expo start
```

Scan the QR code with the Expo Go app on your iPhone (same Wi-Fi network as your machine).

## Structure

```
App.tsx        # entry screen — currently the "Hoy" (today) view
src/config.ts  # reads EXPO_PUBLIC_API_URL, fails loudly if unset
src/api/       # one module per backend resource, typed fetch wrappers
```

No Xcode/simulator — there's no Mac. All on-device testing goes through Expo Go for now; native builds go through EAS (see `.claude/agents/eas-agent.md`) once something requires leaving Expo Go.
