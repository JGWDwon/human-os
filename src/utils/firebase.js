import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

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
