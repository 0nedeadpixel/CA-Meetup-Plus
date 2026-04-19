import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDQRGipdAaTuR8VFgPT_ql8k6RI1NgCDKg",
    authDomain: "firecode-4ba19.firebaseapp.com",
    projectId: "firecode-4ba19",
    storageBucket: "firecode-4ba19.firebasestorage.app",
    messagingSenderId: "793688834360",
    appId: "1:793688834360:web:6b43d63add4212d12a81cd",
    measurementId: "G-9GDLLKFYCL"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    try {
        console.log("Fetching sessions...");
        const sessionsSnap = await getDocs(collection(db, 'sessions'));
        
        const communityStats: Record<string, { sessions: number, redeemedCodes: number }> = {};
        
        for (const doc of sessionsSnap.docs) {
            const data = doc.data();
            const communityName = data.ambassador?.communityName || 'Unknown Community';
            
            if (!communityStats[communityName]) {
                communityStats[communityName] = { sessions: 0, redeemedCodes: 0 };
            }
            communityStats[communityName].sessions++;
            
            // Get codes for this session
            const codesSnap = await getDocs(collection(db, `sessions/${doc.id}/codes`));
            const redeemed = codesSnap.docs.filter(c => c.data().claimed === true).length;
            communityStats[communityName].redeemedCodes += redeemed;
        }
        
        console.log("\n--- Redeemed Codes by Community ---");
        for (const [community, stats] of Object.entries(communityStats)) {
            console.log(`${community}: ${stats.redeemedCodes} redeemed codes (across ${stats.sessions} sessions)`);
        }
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
