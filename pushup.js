const WebSocket = require("ws")
const axios = require("axios")
const http = require("http")

const EMAIL = process.env.EMAIL
const PASSWORD = process.env.PASSWORD

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
    Math.max(+t.match(/(\d{1,2})\s*p/i)?.[1] || 1,1),
    12
  ),

  sea: Math.min(
    Math.max(+t.match(/sea\s*(\d)/i)?.[1] || 1,1),
    3
  )
})

async function login(){

  console.log("logging in...")

  const x = axios.create({
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  })

  const fp = await x.get(
    "https://discord.com/api/v9/experiments"
  )

  const fingerprint = fp.data.fingerprint

  const r = await x.post(
    "https://discord.com/api/v9/auth/login",
    {
      login: EMAIL,
      password: PASSWORD
    },
    {
      headers: {
        "X-Fingerprint": fingerprint,
        "Content-Type": "application/json"
      }
    }
  )

  if(!r.data.token){
    throw new Error("login fail")
  }

  console.log("logged in")
  console.log(r.data.user.username)

  return r.data.token
}

function start(token){

  let ws
  let hb

  const connect = () => {

    console.log("connecting gateway")

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

        console.log("gateway hello")

        ws.send(JSON.stringify({
          op: 2,
          d: {
            token,
            intents: 3276799,
            properties: {
              os: "Windows",
              browser: "Chrome",
              device: ""
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

      if(data.t === "READY"){
        console.log("READY")
        console.log(data.d.user.username)
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

      console.log("MESSAGE")
      console.log(text)

      const boss = channels[m.channel_id]

      if(!boss) return

      const job = getJobId(text)

      if(!job){
        console.log("no job")
        return
      }

      if(pushed.has(job)){
        console.log("duplicate")
        return
      }

      pushed.set(job,1)

      setTimeout(() => {
        pushed.delete(job)
      },30000)

      const { players, sea } = parseExtra(text)

      const payload = {
        id: API_ID,
        job,
        boss,
        players,
        sea
      }

      console.log(payload)

      try{

        const r = await axios.post(API,payload)

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

    ws.on("close", () => {

      console.log("gateway close")

      clearInterval(hb)

      setTimeout(connect,5000)

    })

    ws.on("error", e => {
      console.log(e.message)
    })

  }

  connect()
}

;(async()=>{

  try{

    const token = await login()

    start(token)

  }catch(e){

    console.log("FATAL")
    console.log(e.message)

  }

})()

http.createServer((req,res)=>{

  res.end("ok")

}).listen(process.env.PORT || 3000,()=>{

  console.log("HTTP READY")

})
