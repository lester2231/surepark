import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, update } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAXExMaik-LJ9Vc_CcrgeqoD7M6FXzgAx0",
  authDomain: "surepark-c045a.firebaseapp.com",
  databaseURL: "https://surepark-c045a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "surepark-c045a",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// 🔥 REAL-TIME LISTENER
export const listenToSlot = (slotId: string, callback: (data: any) => void) => {
  const slotRef = ref(db, `slots/${slotId}`);

  onValue(slotRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(data);
    }
  });
};

// 🔥 OPTIONAL: update slot (frontend control)
export const updateSlot = (slotId: string, data: any) => {
  const slotRef = ref(db, `slots/${slotId}`);
  return update(slotRef, data);
};