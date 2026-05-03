async function run() {
    const res = await fetch('https://www.keralalotteries.net/feeds/posts/default?q=02-05-2026&alt=json');
    if (res.ok) {
        const json = await res.json();
        console.log("Found:", json.feed.entry?.length || 0);
        if(json.feed.entry) {
            json.feed.entry.forEach(en => { console.log(en.title.$t); });
        }
    }
}
run();
