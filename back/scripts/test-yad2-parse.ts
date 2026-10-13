// Usage: npx ts-node scripts/test-yad2-parse.ts <url>   (no DB access)
// Extracts the list page, then opens the first listing and prints its gallery.
import { openYad2Session } from '../src/services/yad2Extractor';

(async () => {
  const url = process.argv[2] || 'https://www.yad2.co.il/realestate/forsale';
  console.log('Fetching', url);
  const session = await openYad2Session();
  try {
    const { listings, candidates } = await session.extractListings(url);
    console.log(`candidates=${candidates} mapped=${listings.length}`);
    console.log(JSON.stringify(listings.slice(0, 3), null, 2));

    const first = listings[0];
    if (first) {
      console.log('\nOpening item page', first.externalUrl);
      const details = await session.extractItemDetails(first);
      console.log(`list images=${first.images.length} item images=${details.images.length}`);
      console.log('description:', details.description);
      console.log('condition:', details.condition);
      console.log('features:', details.features.join(', '));
    }
  } catch (e: any) {
    console.error('FAILED:', e.message);
    process.exitCode = 1;
  } finally {
    await session.close();
  }
})();
