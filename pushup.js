const WebSocket = require("ws")
const axios = require("axios")
const http = require("http")

const TOKEN = process.env.DISCORD_TOKEN

const API = "https://apihop-test-9hcq.onrender.com/push"
const API_ID = "gvmi7fpuwnt"

const channels = {
  "1450081431932899368": "full_moon",
  "1510171866705428480": "elite",
  "1485223593087471777": "haki",
  "1450081260150980743": "daobian"
}

const pushed = new Map()

const getJobId = t =>
  t.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  )?.[0]

const parseExtra = t => ({
  players: Math.min(
    Math.max(
      +t.match(/(\d{1,2})\s*p/i)?.[1] || 1,
      1
    ),
    12
  ),

  sea: Math.min(
    Math.max(
      +t.match(/sea\s*(\d)/i)?.[1] || 1,
      1
    ),
    3
  )
})

let ws
let hb

const connect = () => {

  ws = new WebSocket(
    "wss://gateway.discord.gg/?v=10&encoding=json"
  )

  ws.on("message", async raw => {

    let data

    try{

      data = JSON.parse(raw.toString())

    }catch{

      return

    }

    if(data.op === 10){

      ws.send(JSON.stringify({
        op: 2,
        d: {
          token: TOKEN,
          intents: 33281,
          properties: {
            os: "Windows",
            browser: "Chrome",
            device: ""
          },
          presence: {
            status: "online",
            since: 0,
            activities: [],
            afk: false
          }
        }
      }))

      hb = setInterval(() => {

        if(ws.readyState === 1){

          ws.send(JSON.stringify({
            op: 1,
            d: null
          }))

        }

      }, data.d.heartbeat_interval)

      return

    }

    if(data.op === 9){

      console.log("invalid discord token")

      process.exit()

    }

    if(data.t !== "MESSAGE_CREATE") return

    const m = data.d

    const text =
      m.content ||
      (m.embeds || []).map(e =>
        [
          e.title || "",
          e.description || "",
          ...(e.fields || []).map(f => f.value || "")
        ].join("\n")
      ).join("\n")

    const boss = channels[m.channel_id]

    if(!boss) return

    const job = getJobId(text)

    if(!job) return

    if(pushed.has(job)) return

    pushed.set(job, 1)

    setTimeout(() => {

      pushed.delete(job)

    }, 30000)

    const { players, sea } = parseExtra(text)

    try{

      await axios.post(
        API,
        {
          id: API_ID,
          job,
          boss,
          players,
          sea
        },
        {
          timeout: 10000,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )

    }catch{}

  })

  ws.on("close", () => {

    clearInterval(hb)

    setTimeout(connect, 5000)

  })

  ws.on("error", () => {})

}

if(!TOKEN){

  console.log("missing DISCORD_TOKEN")

}else{

  connect()

}

http.createServer((req,res)=>{

  res.end("ok")

}).listen(process.env.PORT || 3000)
