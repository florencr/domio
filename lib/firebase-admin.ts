import * as admin from "firebase-admin";

let messaging: admin.messaging.Messaging | null = null;

function init() {
  if (messaging) return messaging;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) return null;
  try {
    const cred = JSON.parse(json);
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(cred) });
    }
    messaging = admin.messaging();
    return messaging;
  } catch {
    return null;
  }
}

export function getFcmMessaging(): admin.messaging.Messaging | null {
  return init();
}
