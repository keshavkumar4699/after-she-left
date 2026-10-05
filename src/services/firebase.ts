import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type Auth,
  type Persistence,
  type User,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { Platform } from 'react-native';

import { env, isFirebaseConfigured } from '@/config/env';

/**
 * Firebase is optional. When the EXPO_PUBLIC_FIREBASE_* variables are present the app offers
 * sign-in, cloud sync and AI prayers; otherwise everything stays on the device.
 */

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

function persistence(): Persistence {
  if (Platform.OS === 'web') return browserLocalPersistence;
  // The React Native build of firebase/auth (resolved by Metro) exports getReactNativePersistence.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rn = require('firebase/auth') as { getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence };
  return rn.getReactNativePersistence(AsyncStorage);
}

export function firebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (!app) app = getApps().length ? getApp() : initializeApp(env.firebase);
  return app;
}

export function firebaseAuth(): Auth | null {
  const a = firebaseApp();
  if (!a) return null;
  if (!auth) {
    try {
      auth = initializeAuth(a, { persistence: persistence() });
    } catch {
      auth = getAuth(a); // already initialised (fast refresh)
    }
  }
  return auth;
}

export function db(): Firestore | null {
  const a = firebaseApp();
  return a ? getFirestore(a) : null;
}

export function functions(): Functions | null {
  const a = firebaseApp();
  return a ? getFunctions(a, env.functionsRegion) : null;
}

export function currentUser(): User | null {
  return firebaseAuth()?.currentUser ?? null;
}

export function onUserChanged(cb: (user: User | null) => void): () => void {
  const a = firebaseAuth();
  if (!a) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(a, cb);
}

export async function signUp(email: string, password: string, name: string): Promise<User> {
  const a = firebaseAuth();
  if (!a) throw new Error('Cloud sync is not configured in this build.');
  const cred = await createUserWithEmailAndPassword(a, email.trim(), password);
  if (name) await updateProfile(cred.user, { displayName: name });
  return cred.user;
}

export async function signIn(email: string, password: string): Promise<User> {
  const a = firebaseAuth();
  if (!a) throw new Error('Cloud sync is not configured in this build.');
  const cred = await signInWithEmailAndPassword(a, email.trim(), password);
  return cred.user;
}

export async function signOut(): Promise<void> {
  const a = firebaseAuth();
  if (a) await fbSignOut(a);
}

export async function callFunction<Req, Res>(name: string, data: Req): Promise<Res> {
  const f = functions();
  if (!f) throw new Error('Cloud functions are not configured.');
  const res = await httpsCallable<Req, Res>(f, name)(data);
  return res.data;
}

/** Human-readable auth errors. */
export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'That email address looks wrong.',
    'auth/email-already-in-use': 'An account already uses this email. Try signing in.',
    'auth/weak-password': 'Use at least 6 characters for your password.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/user-not-found': 'No account with this email.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/network-request-failed': 'No connection. Your data is safe on this device.',
    'auth/too-many-requests': 'Too many attempts. Please wait a minute.',
  };
  return map[code] ?? (error instanceof Error ? error.message : 'Something went wrong.');
}
