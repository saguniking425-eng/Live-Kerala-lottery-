import { exec } from 'child_process';

const date = '2026-05-02';

console.log(`Running scraper for ${date}...`);

exec(`python3 scrape_kerala_lottery.py --start ${date} --end ${date}`, (error, stdout, stderr) => {
    if (error) {
        console.error("Scraper error:", error.message);
    }
    console.log("STDOUT", stdout);
    console.error("STDERR", stderr);
});
