const WebSocket = require("ws");
const axios = require("axios");
const http = require("http");
const TOKEN = process.env.DISCORD_TOKEN;
const API = "https://api-trieu.onrender.com/push";
const API_ID = "339184b20867";
const channels = {
  "1474034383047495800": "captain"
};

const pushed = new Map();

const getJobId = (text) =>
  text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
const parsePlayers = (text) => {
  const match = text.match(/Players?:\s*(\d+)\/\d+/i);
  if (match) {
    let players = parseInt(match[1], 10);
    return Math.min(Math.max(players, 1), 12);
  }
  // fallback cho định dạng cũ nếu cần
  const fallback = text.match(/(\d{1,2})\s*p/i);
  return fallback ? Math.min(Math.max(parseInt(fallback[1], 10), 1), 12) : 1;
};

let ws;
let hb;

const connect = () => {
  ws = new WebSocket("wss://gateway.discord.gg/?v=10&encoding=json");

  ws.on("message", async (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (data.op === 10) {
      ws.send(
        JSON.stringify({
          op: 2,
          d: {
            token: TOKEN,
            intents: 33281,
            properties: {
              os: "Windows",
              browser: "Chrome",
              device: "",
            },
            presence: {
              status: "online",
              since: 0,
              activities: [],
              afk: false,
            },
          },
        })
      );

      hb = setInterval(() => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ op: 1, d: null }));
        }
      }, data.d.heartbeat_interval);
      return;
    }

    if (data.op === 9) {
      console.log("Invalid Discord token");
      process.exit();
    }

    if (data.t !== "MESSAGE_CREATE") return;

    const m = data.d;
    const text =
      m.content ||
      (m.embeds || []).map((e) =>
        [e.title || "", e.description || "", ...(e.fields || []).map((f) => f.value || "")].join("\n")
      ).join("\n");

    const boss = channels[m.channel_id];
    if (!boss) return;               // chỉ xử lý nếu đúng kênh captain
    if (boss !== "captain") return;  // an toàn: chỉ lấy captain

    const job = getJobId(text);
    if (!job) return;

    if (pushed.has(job)) return;
    pushed.set(job, 1);
    setTimeout(() => pushed.delete(job), 30000);

    const players = parsePlayers(text);
    const sea = 2;   // Cursed Captain chỉ ở Sea 2

    try {
      await axios.post(
        API,
        {
          id: API_ID,
          job,
          boss,
          players,
          sea,
        },
        {
          timeout: 10000,
          headers: { "Content-Type": "application/json" },
        }
      );
      console.log(`✅ Đã gửi: ${job} | players=${players} | sea=${sea}`);
    } catch (err) {
      console.error("❌ Lỗi gửi API:", err.message);
    }
  });

  ws.on("close", () => {
    clearInterval(hb);
    setTimeout(connect, 5000);
  });

  ws.on("error", (err) => console.error("WebSocket error:", err.message));
};

if (!TOKEN) {
  console.log("Thiếu DISCORD_TOKEN trong environment variables");
} else {
  connect();
}

http.createServer((req, res) => res.end("web by trieu🥱😐")).listen(process.env.PORT || 3000);
