const WebSocket = require("ws");
const axios = require("axios");
const http = require("http");

const TOKEN = process.env.DISCORD_TOKEN;
const API_KEY = process.env.API_KEY;
const API = "https://api-trieu.onrender.com/push";
const API_ID = "41e5499a87bb";

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

const clean = (s) => s.replace(/[`*_~]/g, "").trim();

const parseSwordName = (text) => {
  let regex = /Swords?\s*Name\s*:\s*([^\n]+)/i;
  let match = text.match(regex);
  if (match) {
    const v = clean(match[1]);
    if (v) return v;
  }

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/Swords?\s*Name\s*:/i.test(line)) {
      let inlineMatch = line.match(/Swords?\s*Name\s*:\s*(.+)/i);
      if (inlineMatch) {
        const v = clean(inlineMatch[1]);
        if (v) return v;
      }
      let nextLine = lines[i + 1];
      if (nextLine) {
        const v = clean(nextLine);
        if (v) return v;
      }
    }
  }

  const nameCandidate = text.match(/(?:Swords?\s*Name\s*:)[^\n]*\n\s*([A-Za-z]+)/i);
  if (nameCandidate && nameCandidate[1]) return clean(nameCandidate[1]);

  return null;
};

let ws;
let hb;
let reconnectTimer = null;
let processingQueue = false;
let messageQueue = [];

const getUserAgent = () => {
  const versions = ["Windows NT 10.0; Win64; x64", "Macintosh; Intel Mac OS X 10_15_7", "X11; Linux x86_64"];
  const chromeVer = `Chrome/${Math.floor(Math.random() * 30) + 90}.0.${Math.floor(Math.random() * 2000) + 4000}.${Math.floor(Math.random() * 100)}`;
  return `Mozilla/5.0 (${versions[Math.floor(Math.random() * versions.length)]}) AppleWebKit/537.36 (KHTML, like Gecko) ${chromeVer} Safari/537.36`;
};

const processMessage = async (m) => {
  const text = m.content || (m.embeds || []).map(e =>
    [e.title || "", e.description || "", ...(e.fields || []).map(f => f.value || "")].join("\n")
  ).join("\n");

  const bossType = channels[m.channel_id];
  if (!bossType) return;

  const job = getJobId(text);
  if (!job) return;

  if (pushed.has(job)) return;

  pushed.set(job, 1);
  setTimeout(() => pushed.delete(job), 30000);

  const players = parsePlayers(text);
  const sea = 2;

  let boss = bossType;
  if (bossType === "sword") {
    const swordName = parseSwordName(text);
    if (!swordName) return;
    boss = swordName;
  }

  const delay = Math.floor(Math.random() * 2000) + 1000;
  await new Promise(resolve => setTimeout(resolve, delay));

  try {
    await axios.post(API, { id: API_ID, apiKey: API_KEY, job, boss, players, sea }, {
      timeout: 10000,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    if (err.response && err.response.status === 429) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

const queueProcessor = async () => {
  if (processingQueue) return;
  processingQueue = true;
  while (messageQueue.length > 0) {
    const m = messageQueue.shift();
    await processMessage(m);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  processingQueue = false;
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

      if (hb) clearInterval(hb);
      hb = setInterval(() => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ op: 1, d: Date.now() }));
        }
      }, data.d.heartbeat_interval);
      return;
    }

    if (data.op === 9) {
      clearInterval(hb);
      ws.terminate();
      reconnectTimer = setTimeout(connect, 5000);
      return;
    }

    if (data.t !== "MESSAGE_CREATE") return;

    const m = data.d;
    messageQueue.push(m);
    queueProcessor();
  });

  ws.on("close", () => {
    clearInterval(hb);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    const delay = Math.floor(Math.random() * 8000) + 8000;
    reconnectTimer = setTimeout(connect, delay);
  });

  ws.on("error", () => {});
};

if (!TOKEN || !API_KEY) {
  process.exit(1);
} else {
  connect();
}

http.createServer((req, res) => res.end("web by trieu🥱😐")).listen(process.env.PORT || 3000);
