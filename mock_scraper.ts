import { getFirestore, initializeFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import firebaseConfigJSON from './firebase-applet-config.json' with { type: 'json' };

const firebaseApp = initializeApp(firebaseConfigJSON);
const db = initializeFirestore(firebaseApp, {
  experimentalForceLongPolling: true
}, firebaseConfigJSON.firestoreDatabaseId);

async function runMockScraper() {
  const args = process.argv.slice(2);
  let dateStr = new Date().toISOString().split('T')[0];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start' && args[i+1]) {
      dateStr = args[i+1];
    }
  }

  console.log(`Mock scraper running for date: ${dateStr}...`);

  try {
    // Generate a mock result
    const lotteries = ['Win-Win', 'Sthree Sakthi', 'Fifty-Fifty', 'Karunya Plus', 'Nirmal', 'Karunya', 'Akshaya'];
    const codes = ['W', 'S', 'F', 'KP', 'N', 'K', 'A'];
    
    // Day of week index (0 = Sunday, 1 = Monday ...)
    const dayOfWeek = new Date(dateStr).getDay();
    // Wrap to 0-6 index into array (Monday = 1, Win-Win is index 0)
    const lotIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; 

    const lotName = lotteries[lotIndex];
    const code = codes[lotIndex];
    const number = `${code}${Math.floor(Math.random()*90 + 10)} ${Math.floor(Math.random()*900000 + 100000)}`;

    const last4 = number.slice(-4);

    const docRef = await addDoc(collection(db, 'lottery_draws'), {
      date: dateStr,
      lotteryName: lotName,
      drawNo: `${code}-${Math.floor(Math.random()*500 + 100)}`,
      tier: '1st Prize',
      series: code,
      number: number,
      last4: last4,
      amount: '8000000',
      createdAt: serverTimestamp()
    });

    console.log(`Successfully scraped result for ${lotName} - draw ${dateStr} into ${docRef.id}`);
  } catch (error) {
    console.error("Mock scraper error:", error);
    process.exit(1);
  }
}

runMockScraper();
