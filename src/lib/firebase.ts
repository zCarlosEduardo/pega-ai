import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

/**
 * Cliente Firebase (browser).
 *
 * Defina no .env.local (e no host: Vercel/Lovable/Firebase Hosting):
 *   VITE_FIREBASE_API_KEY=...
 *   VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
 *   VITE_FIREBASE_PROJECT_ID=seu-projeto
 *   VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
 *   VITE_FIREBASE_MESSAGING_SENDER_ID=...
 *   VITE_FIREBASE_APP_ID=...
 *
 * Essas chaves são públicas (config de cliente do Firebase) — quem protege
 * os dados são as Security Rules em /firebase/firestore.rules.
 */
const env = import.meta.env as Record<string, string | undefined>;

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const hasFirebase = Boolean(config.apiKey && config.projectId && config.appId);

/**
 * Firestore com cache offline persistente (IndexedDB), compartilhado entre abas:
 *  - o app abre offline com os últimos dados;
 *  - alterações feitas sem internet ficam na fila e são enviadas quando a conexão volta,
 *    mesmo se o app for fechado e reaberto (antes elas morriam na memória).
 * Se o navegador não suportar IndexedDB (ex.: modo privado), cai para o cache em memória.
 */
function createDb(app: FirebaseApp): Firestore {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // já inicializado (HMR) ou persistência indisponível
    return getFirestore(app);
  }
}

let app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

if (hasFirebase && typeof window !== "undefined") {
  app = getApps().length ? getApp() : initializeApp(config as Required<typeof config>);
  _auth = getAuth(app);
  _db = createDb(app);
}

export const auth = _auth;
export const db = _db;
