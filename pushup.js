const WebSocket = require("ws");
const axios = require("axios");
const http = require("http");

const TOKEN = process.env.DISCORD_TOKEN;
const API_KEY = process.env.API_KEY;
const API = "https://api-trieu.onrender.com/push";
const API_ID = "a2553af40887";

const channels = {
  "1474034383047495800": "captain",
  "1485223680853147779": "sword"
};

const pushed = new Map();

const getJobId = (text) =>
  text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];

const parsePlayers = (text) => {
  let match = text.match(/Players?:\s*(\d+)\/\d+/i);
  if (match) return Math.min(Math.max(parseInt(match[1], 10), 1), 12);
  match = text.match(/(\d+)\/\d+/);
  if (match) return Math.min(Math.max(parseInt(match[1], 10), 1), 12);
  match = text.match(/(\d{1,2})\s*p/i);
  if (match) return Math.min(Math.max(parseInt(match[1], 10), 1), 12);
  return 1;
};

const parseSwordName = (text) => {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/Swords?\s*Name:/i.test(lines[i])) {
      let match = lines[i].match(/Swords?\s*Name:\s*(.+)/i);
      if (match && match[1].trim()) return match[1].trim();
      if (i + 1 < lines.length && lines[i + 1].trim()) {
        return lines[i + 1].trim();
      }
    }
  }
  return null;
};

let ws;
let hb;
let reconnectTimer = null;

const getUserAgent = () => {
  const versions = ["Windows NT 10.0; Win64; x64", "Macintosh; Intel Mac OS X 10_15_7", "X11; Linux x86_64"];
  const chromeVer = `Chrome/${Math.floor(Math.random() * 30) + 90}.0.${Math.floor(Math.random() * 2000) + 4000}.${Math.floor(Math.random() * 100)}`;
  return `Mozilla/5.0 (${versions[Math.floor(Math.random() * versions.length)]}) AppleWebKit/537.36 (KHTML, like Gecko) ${chromeVer} Safari/537.36`;
};

const connect = () => {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  const headers = {
    'User-Agent': getUserAgent(),
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };

  ws = new WebSocket("wss://gateway.discord.gg/?v=10&encoding=json", { headers });
  console.log(`[${new Date().toISOString()}] 🔌 Đang kết nối WebSocket...`);

  ws.on("message", async (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (data.op === 10) { // Hello event
      ws.send(JSON.stringify({
        op: 2,
        d: {
          token: TOKEN,
          properties: {
            os: process.platform === "win32" ? "Windows" : (process.platform === "darwin" ? "Mac OS X" : "Linux"),
            browser: "Chrome",
            device: "",
            browser_user_agent: getUserAgent(),
            browser_version: "120.0.0.0",
            os_version: "10",
            referrer: "",
            referring_domain: "",
            referrer_current: "",
            referring_domain_current: "",
            release_channel: "stable",
            client_build_number: 254479,
            client_event_source: null
          },
          compress: false,
          large_threshold: 250,
          intents: 33281,
          presence: {
            status: "invisible",
            since: 0,
            activities: [],
            afk: true
          }
        }
      }));
      console.log(`[${new Date().toISOString()}] ✅ Đã gửi identify, chờ ready...`);

      hb = setInterval(() => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ op: 1, d: Date.now() }));
        }
      }, data.d.heartbeat_interval);
      return;
    }

    if (data.op === 9) { // Invalid session, cần reconnect
      console.log(`[${new Date().toISOString()}] ⚠️ Opcode 9: Invalid session, sẽ reconnect sau 5s`);
      clearInterval(hb);
      ws.terminate();
      reconnectTimer = setTimeout(connect, 5000);
      return;
    }

    if (data.t === "READY") {
      console.log(`[${new Date().toISOString()}] 🎉 Bot đã sẵn sàng, lắng nghe tin nhắn.`);
    }

    if (data.t !== "MESSAGE_CREATE") return;

    const m = data.d;
    const text = m.content || (m.embeds || []).map(e =>
      [e.title || "", e.description || "", ...(e.fields || []).map(f => f.value || "")].join("\n")
    ).join("\n");

    const bossType = channels[m.channel_id];
    if (!bossType) return;

    console.log(`[${new Date().toISOString()}] 📨 Nhận tin từ kênh ${bossType} (${m.channel_id})`);

    const job = getJobId(text);
    if (!job) {
      console.log(`[${new Date().toISOString()}] ⚠️ Không tìm thấy Job ID`);
      return;
    }

    if (pushed.has(job)) {
      console.log(`[${new Date().toISOString()}] ⏭️ Job ${job} đã được push gần đây, bỏ qua`);
      return;
    }

    pushed.set(job, 1);
    setTimeout(() => pushed.delete(job), 30000);

    const players = parsePlayers(text);
    const sea = 2;

    let boss = bossType;
    if (bossType === "sword") {
      const swordName = parseSwordName(text);
      if (!swordName) {
        console.log(`[${new Date().toISOString()}] ⚠️ Không parse được tên sword, bỏ qua`);
        return;
      }
      boss = swordName;
    }

    try {
      await axios.post(API, { id: API_ID, apiKey: API_KEY, job, boss, players, sea }, {
        timeout: 10000,
        headers: { "Content-Type": "application/json" }
      });
      console.log(`[${new Date().toISOString()}] ✅ Đã push: ${job} | boss: ${boss} | players: ${players}/12 | sea: ${sea}`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] ❌ Lỗi push API: ${err.message}`);
    }
  });

  ws.on("close", (code, reason) => {
    console.log(`[${new Date().toISOString()}] 🔴 WebSocket đóng (code: ${code}, reason: ${reason})`);
    clearInterval(hb);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    const delay = Math.floor(Math.random() * 8000) + 8000; // 8-16 giây
    console.log(`[${new Date().toISOString()}] 🔄 Sẽ thử kết nối lại sau ${delay/1000} giây...`);
    reconnectTimer = setTimeout(connect, delay);
  });

  ws.on("error", (err) => {
    console.error(`[${new Date().toISOString()}] ❌ WebSocket error: ${err.message}`);
  });
};

if (!TOKEN || !API_KEY) {
  console.error("❌ Thiếu DISCORD_TOKEN hoặc API_KEY trong biến môi trường!");
  process.exit(1);
} else {
  console.log("🚀 Bot khởi động, đang kết nối Discord...");
  connect();
}

http.createServer((req, res) => res.end("web by trieu🥱😐")).listen(process.env.PORT || 3000);
