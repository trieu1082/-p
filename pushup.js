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
  t.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0]

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

  console.log("connecting...")

  ws = new WebSocket(
    "wss://gateway.discord.gg/?v=10&encoding=json"
  )

  ws.on("open", () => {
    console.log("ws open")
  })

  ws.on("message", async raw => {

    let data

    try{
      data = JSON.parse(raw.toString())
    }catch(e){
      console.log("json fail")
      return
    }

    console.log("op:", data.op, "t:", data.t)

    if(data.op === 10){

      console.log("heartbeat:", data.d.heartbeat_interval)

      ws.send(JSON.stringify({
        op: 2,
        d: {
          token: TOKEN,
          capabilities: 16381,
          properties: {
            os: "Windows",
            browser: "Chrome",
            device: "",
            system_locale: "en-US",
            browser_user_agent:
              "Mozilla/5.0",
            browser_version: "125.0.0.0",
            os_version: "10",
            referrer: "",
            referring_domain: "",
            release_channel: "stable",
            client_build_number: 9999,
            client_event_source: null
          },
          presence: {
            status: "online",
            since: 0,
            activities: [],
            afk: false
          },
          compress: false,
          client_state: {
            guild_versions: {}
          }
        }
      }))

      hb = setInterval(() => {

        if(ws.readyState === 1){

          ws.send(JSON.stringify({
            op: 1,
            d: null
          }))

          console.log("heartbeat sent")

        }

      }, data.d.heartbeat_interval)

      return
    }

    if(data.op === 11){
      console.log("heartbeat ack")
    }

    if(data.t === "READY"){
      console.log("READY EVENT")
    }

    if(data.t !== "MESSAGE_CREATE") return

    const m = data.d

    console.log("MESSAGE")
    console.log(m.channel_id)
    console.log(m.content)

    const boss = channels[m.channel_id]

    if(!boss){
      console.log("wrong channel")
      return
    }

    const job = getJobId(m.content || "")

    console.log("job:", job)

    if(!job){
      console.log("no job")
      return
    }

    if(pushed.has(job)){
      console.log("duplicate")
      return
    }

    pushed.set(job, 1)

    setTimeout(() => {
      pushed.delete(job)
    }, 30000)

    const { players, sea } = parseExtra(m.content)

    const payload = {
      id: API_ID,
      job,
      boss,
      players,
      sea
    }

    console.log(payload)

    try{

      const r = await axios.post(API, payload)

      console.log("PUSH OK")
      console.log(r.data)

    }catch(e){

      console.log("PUSH FAIL")

      if(e.response){
        console.log(e.response.status)
        console.log(e.response.data)
      }else{
        console.log(e.message)
      }

    }

  })

  ws.on("close", c => {
    console.log("closed", c)
    clearInterval(hb)
    setTimeout(connect, 5000)
  })

  ws.on("error", e => {
    console.log("ws err", e.message)
  })

}

connect()

http.createServer((req,res)=>{
  res.end("ok")
}).listen(process.env.PORT || 3000, ()=>{
  console.log("HTTP READY")
})
