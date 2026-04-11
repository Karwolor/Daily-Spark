// Minimal Firebase setup with placeholders
// 1) Create a Firebase project
// 2) Enable Authentication (Anonymous) and Firestore
// 3) Paste your config below

// Guard global firebase compat objects to avoid redeclaration during dev reloads
window._auth = window._auth || null;
window._db = window._db || null;
window._messaging = window._messaging || null;

function initFirebase() {
    if (window.firebase?.apps?.length) {
        console.log('[Firebase] Already initialized');
        return;
    }
    
    console.log('[Firebase] Starting initialization...');
    // Use v9 compat via CDN for simplicity
    const scripts = [
        'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
        'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
        'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
        'https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js'
    ];

    let loaded = 0;
    const onload = () => {
        loaded++;
        console.log(`[Firebase] Script loaded (${loaded}/${scripts.length})`);
        if (loaded < scripts.length) return;
        
        const firebaseConfig = {
            apiKey: import.meta.env.VITE_FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY,
            authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || process.env.REACT_APP_FIREBASE_PROJECT_ID,
            storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
            appId: import.meta.env.VITE_FIREBASE_APP_ID || process.env.REACT_APP_FIREBASE_APP_ID,
            measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
        };
        
        console.log('[Firebase] All scripts loaded, initializing app...', { projectId: firebaseConfig.projectId });
        
        try {
            if (!window.firebase) {
                console.error('[Firebase] firebase object not available after script load');
                return;
            }
            
            const app = firebase.initializeApp(firebaseConfig);
            console.log('[Firebase] App initialized');
            
            window._auth = window._auth || firebase.auth(app);
            window._db = window._db || firebase.firestore(app);
            console.log('[Firebase] Auth and Firestore initialized');
            
            // Initialize Analytics if available
            if (firebase.analytics) try { firebase.analytics(app); console.log('[Firebase] Analytics enabled'); } catch (e) { console.warn('[Firebase] Analytics init failed', e); }
            
            // Initialize Messaging if available
            if (firebase.messaging) try { window._messaging = window._messaging || firebase.messaging(app); console.log('[Firebase] Messaging enabled'); } catch (e) { console.warn('[Firebase] Messaging init failed', e); }
            
            // Enable offline persistence (optional)
            if (window._db && window._db.enableIndexedDbPersistence) {
                window._db.enableIndexedDbPersistence().then(() => {
                    console.log('[Firebase] Offline persistence enabled');
                }).catch((err) => { 
                    console.warn('[Firebase] Offline persistence already enabled or failed', err);
                });
            }
            
            // Auto sign-in anonymously
            if (window._auth) {
                console.log('[Firebase] Setting up auth state listener');
                window._auth.onAuthStateChanged((u) => {
                    console.log('[Firebase] Auth state changed:', u ? `uid: ${u.uid}` : 'not authenticated');
                    if (!u) {
                        console.log('[Firebase] Attempting anonymous sign-in...');
                        window._auth.signInAnonymously().then((cred) => {
                            console.log('[Firebase] Anonymous sign-in successful:', cred.user.uid);
                        }).catch((err) => {
                            console.error('[Firebase] signInAnonymously error:', err);
                        });
                    }
                });
            }
        } catch (e) {
            console.error('[Firebase] Initialization error:', e);
        }
    };

    // Create and load all scripts
    scripts.forEach((src, idx) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = onload;
        s.onerror = () => console.error(`[Firebase] Failed to load script ${idx}:`, src);
        document.head.appendChild(s);
    });
}

initFirebase();

function onAuthChanged(cb) {
    const iv = setInterval(() => { if (_auth) { _auth.onAuthStateChanged(cb); clearInterval(iv); } }, 200);
}

async function signInAnonymously() { return _auth.signInAnonymously(); }
async function signOutUser() { return _auth.signOut(); }

// Optional: Add Google Sign-In
async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    return _auth.signInWithPopup(provider);
}

// Optional: Add Email/Password Sign-In
async function signInWithEmailPassword(email, password) {
    return _auth.signInWithEmailAndPassword(email, password);
}

async function signUpWithEmailPassword(email, password) {
    return _auth.createUserWithEmailAndPassword(email, password);
}

async function saveUserLog(uid, doc) {
    console.log('[Firestore] Saving log for user:', uid);
    try {
        // Use timestamp-based ID to allow multiple entries per day
        const logId = `${doc.date}_${doc.createdAt || Date.now()}`;
        const logData = { ...doc, logId }; // Store the ID in the document too
        const result = await _db.collection('users').doc(uid).collection('logs').doc(logId).set(logData, { merge: true });
        console.log('[Firestore] Log saved successfully with ID:', logId);
        return result;
    } catch (e) {
        console.error('[Firestore] Error saving log:', e.code, e.message);
        throw e;
    }
}

async function getRecentLogs(uid) {
    console.log('[Firestore] Loading recent logs for user:', uid);
    try {
        if (!_db) {
            throw new Error('Firestore not initialized');
        }
        const snap = await _db.collection('users').doc(uid).collection('logs').orderBy('createdAt', 'desc').limit(30).get();
        console.log('[Firestore] Retrieved', snap.docs.length, 'logs');
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.error('[Firestore] Error loading logs:', e.code, e.message);
        throw e;
    }
}

async function deleteUserLog(uid, logId) {
    console.log('[Firestore] Deleting log for user:', uid, 'log id:', logId);
    try {
        const result = await _db.collection('users').doc(uid).collection('logs').doc(logId).delete();
        console.log('[Firestore] Log deleted successfully');
        return result;
    } catch (e) {
        console.error('[Firestore] Error deleting log:', e.code, e.message);
        throw e;
    }
}

async function saveChallengeCompletion(uid, doc) {
    console.log('[Firestore] Saving challenge completion for user:', uid);
    try {
        const id = doc.date;
        const result = await _db.collection('users').doc(uid).collection('challenges').doc(id).set(doc, { merge: true });
        console.log('[Firestore] Challenge saved successfully');
        return result;
    } catch (e) {
        console.error('[Firestore] Error saving challenge:', e.code, e.message);
        throw e;
    }
}

async function saveCustomChallenge(uid, challenge) {
    return _db.collection('users').doc(uid).collection('customChallenges').add(challenge);
}

async function updatePremiumStatus(uid, status) {
    return _db.collection('users').doc(uid).set({ isPremium: status }, { merge: true });
}

async function requestNotificationPermission() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const token = await _messaging.getToken();
            console.log('FCM Token:', token);
            // Save token for server-side sending
            return token;
        }
    } catch (e) {
        console.error('Notification permission failed:', e);
    }
}
