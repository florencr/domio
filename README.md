Domio – Condo/HOA management app. Built with [Next.js](https://nextjs.org), bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3001](http://localhost:3001) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Mobile (Phase 1 – online only)

The app uses [Capacitor](https://capacitorjs.com) so the same codebase runs on web and mobile. The mobile app loads your deployed web app in a native shell (online only).

**Setup**

1. Deploy your app (e.g. Vercel) and note the URL.
2. Set the URL when syncing:
   - Windows: `$env:CAPACITOR_APP_URL="https://your-app.vercel.app"; npm run cap:sync`
   - Mac/Linux: `CAPACITOR_APP_URL=https://your-app.vercel.app npm run cap:sync`
3. Open and run:
   - iOS: `npm run cap:open:ios` (requires Xcode on Mac)
   - Android: `npm run cap:open:android` (requires Android Studio)

**Dev on device:** Use your machine’s LAN IP (e.g. `http://192.168.1.5:3001`) or [ngrok](https://ngrok.com) so the phone can reach `npm run dev`.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
