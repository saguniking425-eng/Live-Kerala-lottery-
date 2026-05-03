import { exec } from 'child_process';

const today = new Date();
const pastDate = new Date();
pastDate.setDate(today.getDate() - 30);

const start = pastDate.toISOString().split('T')[0];
const end = today.toISOString().split('T')[0];

console.log(`Running scraper from ${start} to ${end}...`);

exec(`python3 scrape_kerala_lottery.py --start ${start} --end ${end}`, (error, stdout, stderr) => {
    if (error) {
        console.error("Scraper error:", error.message);
    }
    console.log("STDOUT", stdout);
    console.error("STDERR", stderr);
});
