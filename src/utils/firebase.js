import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signOut
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';

const firebaseConfig = {
  apiKey: "AIzaSyBCqdsU5fljHdv-DufQra0nQDecP11n4Eo",
  authDomain: "wonn-a4255.firebaseapp.com",
  projectId: "wonn-a4255",
  storageBucket: "wonn-a4255.firebasestorage.app",
  messagingSenderId: "799105733830",
  appId: "1:799105733830:web:5634eeee4bfe932cc1f3c7",
  measurementId: "G-17YP0M30ZN"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    // ─── 안드로이드 네이티브 앱: 기기 내장 구글 계정 시스템 사용 ───
    if (Capacitor.isNativePlatform()) {
      const { SocialLogin } = await import('@capgo/capacitor-social-login');

      // 플러그인 초기화 (Web Client ID = Firebase 콘솔 → 프로젝트 설정 → 웹 클라이언트 ID)
      await SocialLogin.initialize({
        google: {
          webClientId: '799105733830-web-client-id.apps.googleusercontent.com', // TODO: 사용자 교체 필요
        }
      });

      const result = await SocialLogin.login({ provider: 'google', options: {} });
      const idToken = result?.result?.idToken;

      if (!idToken) throw new Error('Google 로그인 토큰을 받지 못했습니다.');

      // 네이티브 토큰 → Firebase 인증으로 변환
      const credential = GoogleAuthProvider.credential(idToken);
      const firebaseResult = await signInWithCredential(auth, credential);
      return firebaseResult.user;
    }

    // ─── 웹 브라우저: 기존 팝업 방식 유지 ───
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google Sign In Error:", error);
    throw error;
  }
};

export const logout = async () => {
  return signOut(auth);
};

// 클라우드 동기화 함수
export const syncDataToCloud = async (userId, data) => {
  if (!userId) return;
  try {
    await setDoc(doc(db, "users", userId), data);
  } catch (error) {
    console.error("Error syncing to cloud:", error);
  }
};

export const fetchCloudData = async (userId) => {
  if (!userId) return null;
  try {
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (error) {
    console.error("Error fetching from cloud:", error);
  }
  return null;
};
