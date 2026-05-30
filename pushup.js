const WebSocket = require("ws")
const axios = require("axios")

const TOKEN = process.env.DISCORD_TOKEN

const API = "https://apihop-test-9hcq.onrender.com/api/gvmi7fpuwnt"

const channels = {
  "1450081431932899368": "full_moon",
  "1510171866705428480": "elite",
  "1485223593087471777": "haki",
  "1450081260150980743": "daobian"
}

const pushed = new Map()

const getJobId = t =>
  t.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]

const parseExtra = t => {

  let players =
    +t.match(/(\d{1,2})\s*p/i)?.[1] ||
    Math.floor(Math.random()*12+1)

  let sea =
    +t.match(/sea\s*(\d)/i)?.[1] ||
    Math.floor(Math.random()*3+1)

  return {
    players: Math.min(Math.max(players,1),12),
    sea: Math.min(Math.max(sea,1),3)
  }
}

let ws
let hb
let reconnect = 0

const connect = () => {

  clearInterval(hb)

  ws = new WebSocket(
    "wss://gateway.discord.gg/?v=10&encoding=json"
  )

  ws.on("message", async raw => {

    let data

    try{
      data = JSON.parse(raw)
    }catch{
      return
    }

    if(data.op === 10){

      ws.send(JSON.stringify({
        op: 2,
        d: {
          token: TOKEN,
          properties: {
            os: "windows",
            browser: "chrome",
            device: "pc"
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

      reconnect = 0

      console.log("gateway ready")

      return
    }

    if(data.t !== "MESSAGE_CREATE") return

    const m = data.d

    const boss = channels[m.channel_id]

    if(!boss || !m.content) return

    const job = getJobId(m.content)

    if(!job) return

    if(pushed.has(job)) return

    pushed.set(job, Date.now())

    setTimeout(() => {
      pushed.delete(job)
    }, 30000)

    const { players, sea } = parseExtra(m.content)

    const payload = { job, boss, players, sea };

await axios.post(API, payload, { timeout: 5000 });

    try{

      await axios.post(API, payload, {
        timeout: 5000
      })

      console.log("push", payload)

    }catch(e){

      console.log("push fail", e.message)

    }

  })

  ws.on("close", () => {

    clearInterval(hb)

    reconnect++

    const delay = Math.min(reconnect * 2000, 30000)

    console.log("reconnect", delay)

    setTimeout(connect, delay)

  })

  ws.on("error", () => ws.close())

}

connect()
const http = require('http')

http.createServer((req, res) => {
  res.writeHead(200)
  res.end('ok')
}).listen(process.env.PORT || 3000, () => {
  console.log('HTTP READY')
})
