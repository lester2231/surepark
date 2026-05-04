import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAXExMaik-LJ9Vc_CcrgeqoD7M6FXzgAx0",
  authDomain: "surepark-c045a.firebaseapp.com",
  databaseURL: "https://surepark-c045a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "surepark-c045a",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);