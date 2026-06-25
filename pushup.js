const axios = require("axios");
const http = require("http");

const API_KEY = process.env.API_KEY;
const SOURCE_API = "https://api-njgn.onrender.com/api/decode/pmt/s/cursedcaptain";
const TARGET_API = "https://api-jgmm.onrender.com/push";
const TARGET_KEY = "4f813555929b27f77743adab8ff37a442dd702540016467495b948f46c0bf191";
const TARGET_ID = "32dc04e1d415";

const pushed = new Map();

const fetchAndPushJobs = async () => {
    try {
        const response = await axios.get(SOURCE_API, { timeout: 15000 });
        const data = response.data;

        if (!data || !data.JobId || !Array.isArray(data.JobId)) {
            return;
        }

        for (const item of data.JobId) {
            const jobId = item.JobId;
            if (pushed.has(jobId)) {
                continue;
            }

            pushed.set(jobId, 1);
            setTimeout(() => pushed.delete(jobId), 30000);

            let players = 1;
            if (item.Players) {
                const match = item.Players.match(/(\d+)\/\d+/);
                if (match) {
                    players = Math.min(Math.max(parseInt(match[1], 10), 1), 12);
                }
            }

            const payload = {
                id: TARGET_ID,
                apiKey: TARGET_KEY,
                job: jobId,
                boss: "captain",
                players: players,
                sea: 2
            };

            try {
                await axios.post(TARGET_API, payload, {
                    timeout: 10000,
                    headers: { "Content-Type": "application/json" }
                });
            } catch (err) {
                if (err.response && err.response.status === 429) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    } catch (error) {
    }
};

fetchAndPushJobs();

setInterval(fetchAndPushJobs, 300000);

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
}).listen(process.env.PORT || 3000);
