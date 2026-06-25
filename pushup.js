const axios = require("axios");
const http = require("http");

const SOURCE_API = "https://api-njgn.onrender.com/api/decode/pmt/s/cursedcaptain";
const TARGET_API = "https://api-jgmm.onrender.com/api/32dc04e1d415/all";
const TARGET_KEY = "4f813555929b27f77743adab8ff37a442dd702540016467495b948f46c0bf191";
const TARGET_ID = "32dc04e1d415";

// Hàm tạo IP ngẫu nhiên
const randomIP = () => {
    return Array.from({ length: 4 }, () => Math.floor(Math.random() * 256)).join('.');
};

// Hàm tạo User-Agent ngẫu nhiên
const randomUserAgent = () => {
    const uas = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; rv:89.0) Gecko/20100101 Firefox/89.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0'
    ];
    return uas[Math.floor(Math.random() * uas.length)];
};

const fetchAndPushJobs = async () => {
    try {
        console.log('🔄 Đang lấy danh sách job...');
        const response = await axios.get(SOURCE_API, { timeout: 15000 });
        const data = response.data;

        if (!data || !data.JobId || !Array.isArray(data.JobId)) {
            console.log('⚠️ Không có dữ liệu hoặc JobId không hợp lệ.');
            return;
        }

        console.log(`📦 Tìm thấy ${data.JobId.length} job.`);

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
                const headers = {
                    'Content-Type': 'application/json',
                    'X-Forwarded-For': randomIP(),
                    'User-Agent': randomUserAgent()
                };
                const result = await axios.post(TARGET_API, payload, {
                    timeout: 10000,
                    headers: headers
                });
                console.log(`✅ Đã gửi job ${jobId} - Status: ${result.status}`);
            } catch (err) {
                if (err.response) {
                    console.error(`❌ Lỗi gửi job ${jobId}: Status ${err.response.status}`);
                    if (err.response.status === 429) {
                        console.log('⏳ Rate limit, đợi 5s...');
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    }
                } else {
                    console.error(`❌ Lỗi gửi job ${jobId}: ${err.message}`);
                }
            }
        }
    } catch (error) {
        console.error("❌ Lỗi tổng thể:", error.message);
    }
};

// Chạy lần đầu khi khởi động
fetchAndPushJobs();

// Lặp lại mỗi 5 phút (300.000 ms)
setInterval(fetchAndPushJobs, 300000);

// Web server để giữ ứng dụng hoạt động (Render yêu cầu)
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
}).listen(process.env.PORT || 3000);
