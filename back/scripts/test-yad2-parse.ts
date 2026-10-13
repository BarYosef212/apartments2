// Usage: npx ts-node scripts/test-yad2-parse.ts <url>   (no DB access)
import { extractListings } from '../src/services/yad2Extractor';

(async () => {
  const url = process.argv[2] || 'https://www.yad2.co.il/realestate/forsale';
  console.log('Fetching', url);
  try {
    const { listings, candidates } = await extractListings(url);
    console.log(`candidates=${candidates} mapped=${listings.length}`);
    console.log(JSON.stringify(listings.slice(0, 3), null, 2));
  } catch (e: any) {
    console.error('FAILED:', e.message);
    process.exitCode = 1;
  }
})();
