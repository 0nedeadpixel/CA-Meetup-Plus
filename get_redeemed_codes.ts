import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

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
        const sessionsQuery = query(collection(db, 'sessions'), where('ambassador.communityName', 'in', ['The Pokémon Go East Bay Squad', 'The Pokémon Go East Bay Squad ']));
        const sessionsSnap = await getDocs(sessionsQuery);
        
        let allCodes: any[] = [];
        
        for (const doc of sessionsSnap.docs) {
            const codesSnap = await getDocs(collection(db, `sessions/${doc.id}/codes`));
            codesSnap.forEach(codeDoc => {
                const data = codeDoc.data();
                if (data.claimed) {
                    allCodes.push({
                        code: data.value,
                        ign: data.claimedByIgn || 'Unknown',
                        date: data.claimedAt ? new Date(data.claimedAt.toMillis()).toLocaleString() : 'Unknown Date',
                        source: data.source || 'direct_scan'
                    });
                }
            });
        }
        
        // Sort by date descending (newest first)
        allCodes.sort((a, b) => {
            if (a.date === 'Unknown Date') return 1;
            if (b.date === 'Unknown Date') return -1;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        
        console.log("Code,IGN,Date,Source");
        allCodes.forEach((c) => {
            console.log(`${c.code},${c.ign},"${c.date}",${c.source}`);
        });
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
