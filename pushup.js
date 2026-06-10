const WebSocket = require("ws");
const axios = require("axios");
const http = require("http");

const TOKEN = process.env.DISCORD_TOKEN;
const API = "https://api-trieu.onrender.com/push";
const API_ID = "339184b20867";

const channels = {
  "1474034383047495800": "captain2"
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

let ws;
let hb;

const getUserAgent = () => {
  const versions = ["Windows NT 10.0; Win64; x64", "Macintosh; Intel Mac OS X 10_15_7", "X11; Linux x86_64"];
  const chromeVer = `Chrome/${Math.floor(Math.random() * 30) + 90}.0.${Math.floor(Math.random() * 2000) + 4000}.${Math.floor(Math.random() * 100)}`;
  return `Mozilla/5.0 (${versions[Math.floor(Math.random() * versions.length)]}) AppleWebKit/537.36 (KHTML, like Gecko) ${chromeVer} Safari/537.36`;
};

const connect = () => {
  const headers = {
    'User-Agent': getUserAgent(),
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };

  ws = new WebSocket("wss://gateway.discord.gg/?v=10&encoding=json", { headers });

  ws.on("message", async (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (data.op === 10) {
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

      hb = setInterval(() => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ op: 1, d: Date.now() }));
        }
      }, data.d.heartbeat_interval);
      return;
    }

    if (data.op === 9) {
      console.log("Token không hợp lệ hoặc bị khoá, thoát...");
      process.exit(1);
    }

    if (data.t !== "MESSAGE_CREATE") return;

    const m = data.d;
    const text = m.content || (m.embeds || []).map(e =>
      [e.title || "", e.description || "", ...(e.fields || []).map(f => f.value || "")].join("\n")
    ).join("\n");

    const boss = channels[m.channel_id];
    if (!boss || boss !== "captain") return;

    const job = getJobId(text);
    if (!job) return;

    if (pushed.has(job)) return;
    pushed.set(job, 1);
    setTimeout(() => pushed.delete(job), 30000);

    const players = parsePlayers(text);
    const sea = 2;

    try {
      await axios.post(API, { id: API_ID, job, boss, players, sea }, {
        timeout: 10000,
        headers: { "Content-Type": "application/json" }
      });
      console.log(`✅ Gửi: ${job} | ${players}/12 | sea ${sea}`);
    } catch (err) {
      console.error(`❌ Lỗi gửi API: ${err.message}`);
    }
  });

  ws.on("close", (code, reason) => {
    console.log(`WebSocket đóng (${code}) : ${reason}`);
    clearInterval(hb);
    const newDelay = Math.floor(Math.random() * 10000) + 10000;
    console.log(`Tự động kết nối lại sau ${Math.round(newDelay/1000)} giây...`);
    setTimeout(connect, newDelay);
  });

  ws.on("error", (err) => console.error(`WebSocket error: ${err.message}`));
};

if (!TOKEN) {
  console.log("❌ Thiếu DISCORD_TOKEN trong biến môi trường!");
  process.exit(1);
} else {
  console.log("🚀 Đang kết nối với Discord (dùng user token)...");
  connect();
}

http.createServer((req, res) => res.end("web by trieu🥱😐")).listen(process.env.PORT || 3000);
