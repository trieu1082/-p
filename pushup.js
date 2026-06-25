const axios = require("axios");
const http = require("http");

const SOURCE_API = "https://api-njgn.onrender.com/api/decode/pmt/s/cursedcaptain";
const TARGET_API = "https://api-jgmm.onrender.com/api/32dc04e1d415/all";
const TARGET_KEY = "4f813555929b27f77743adab8ff37a442dd702540016467495b948f46c0bf191";
const TARGET_ID = "32dc04e1d415";

const fetchAndPushJobs = async () => {
    try {
        const response = await axios.get(SOURCE_API, { timeout: 15000 });
        const data = response.data;

        if (!data || !data.JobId || !Array.isArray(data.JobId)) {
            return;
        }

        for (const item of data.JobId) {
            const jobId = item.JobId;
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
        }
    } catch (error) {
        console.error("Lỗi:", error.message);
    }
};

fetchAndPushJobs();

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
}).listen(process.env.PORT || 3000);
