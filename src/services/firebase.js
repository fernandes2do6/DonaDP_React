import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyB06sQzC0eA-QuQfTW_VFMg-E7PqKij_e0",
    authDomain: "app-patricia-afc7d.firebaseapp.com",
    projectId: "app-patricia-afc7d",
    storageBucket: "app-patricia-afc7d.firebasestorage.app",
    messagingSenderId: "278845547701",
    appId: "1:278845547701:web:e9ee0cc5e2fd11079b0afc",
    measurementId: "G-D9R6Y06C7L"
};

const app = initializeApp(firebaseConfig);

// Use modern API with persistent cache (replaces deprecated enableIndexedDbPersistence)
let db;
try {
    db = initializeFirestore(app, {
        localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
        })
    });
} catch {
    // Fallback if already initialized
    db = getFirestore(app);
}

const storage = getStorage(app);

export { db, storage };
