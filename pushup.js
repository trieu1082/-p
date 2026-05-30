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

  console.log("connecting gateway")

  ws = new WebSocket(
    "wss://gateway.discord.gg/?v=10&encoding=json"
  )

  ws.on("open", () => {

    console.log("gateway open")

  })

  ws.on("message", async raw => {

    let data

    try{

      data = JSON.parse(raw.toString())

    }catch{

      console.log("json fail")

      return

    }

    if(data.op === 10){

      console.log("gateway hello")

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

          console.log("heartbeat sent")

        }

      }, data.d.heartbeat_interval)

      return

    }

    if(data.op === 11){

      console.log("heartbeat ack")

    }

    if(data.t === "READY"){

      console.log("READY")
      console.log("logged:", data.d.user.username)

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

    console.log("================================")
    console.log("MESSAGE EVENT")
    console.log("channel:", m.channel_id)
    console.log(text)
    console.log("================================")

    const boss = channels[m.channel_id]

    if(!boss){

      console.log("wrong channel")

      return

    }

    const job = getJobId(text)

    console.log("job:", job)

    if(!job){

      console.log("no job found")

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

    const { players, sea } = parseExtra(text)

    const payload = {
      id: API_ID,
      job,
      boss,
      players,
      sea
    }

    console.log("payload:")
    console.log(payload)

    try{

      const r = await axios.post(
        API,
        payload,
        {
          timeout: 10000,
          headers: {
            "Content-Type": "application/json"
          }
        }
      )

      console.log("PUSH OK")
      console.log(r.data)

    }catch(e){

      console.log("PUSH FAIL")

      if(e.response){

        console.log("status:", e.response.status)

        try{

          console.log(
            JSON.stringify(
              e.response.data,
              null,
              2
            )
          )

        }catch{

          console.log("cannot print response")

        }

      }else{

        console.log(e.message)

      }

    }

  })

  ws.on("close", c => {

    console.log("gateway close:", c)

    clearInterval(hb)

    setTimeout(connect, 5000)

  })

  ws.on("error", e => {

    console.log("gateway error")
    console.log(e.message)

  })

}

if(!TOKEN){

  console.log("missing DISCORD_TOKEN")

}else{

  connect()

}

http.createServer((req,res)=>{

  res.end("xem cái lồn web by trieu ")

}).listen(process.env.PORT || 3000, ()=>{

  console.log("HTTP READY")

})
