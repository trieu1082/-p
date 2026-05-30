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

async function login(){

  console.log("logging in...")

  const x = axios.create({
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36"
    }
  })

  let fingerprint = null

  try{

    const fp = await x.get(
      "https://discord.com/api/v9/experiments"
    )

    fingerprint = fp.data.fingerprint

    console.log("fingerprint ok")

  }catch(e){

    console.log("fingerprint fail")
    console.log(e.message)

  }

  try{

    const r = await x.post(
      "https://discord.com/api/v9/auth/login",
      {
        login: EMAIL,
        password: PASSWORD,
        undelete: false,
        captcha_key: null,
        login_source: null,
        gift_code_sku_id: null
      },
      {
        headers: {
          "Content-Type": "application/json",
          ...(fingerprint
            ? { "X-Fingerprint": fingerprint }
            : {})
        }
      }
    )

    if(!r.data.token){

      console.log(r.data)

      throw new Error("login fail no token")

    }

    console.log("logged in")
    console.log("user:", r.data.user?.username)

    return r.data.token

  }catch(e){

    console.log("LOGIN FAIL")

    if(e.response){

      console.log("status:", e.response.status)

      try{
        console.log(
          JSON.stringify(e.response.data, null, 2)
        )
      }catch{
        console.log("cannot print response")
      }

    }else{

      console.log(e.message)

    }

    throw e

  }

}

function start(token){

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

        console.log("json parse fail")

        return

      }

      if(data.op === 10){

        console.log("gateway hello")

        ws.send(JSON.stringify({
          op: 2,
          d: {
            token,
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
      console.log("text:")
      console.log(text)
      console.log("================================")

      const boss = channels[m.channel_id]

      if(!boss){

        console.log("wrong channel")

        return

      }

      if(!text){

        console.log("empty text")

        return

      }

      const job = getJobId(text)

      console.log("job:", job)

      if(!job){

        console.log("job not found")

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

  connect()

}

;(async()=>{

  try{

    if(!EMAIL || !PASSWORD){

      console.log("missing EMAIL or PASSWORD")

      return

    }

    const token = await login()

    start(token)

  }catch(e){

    console.log("FATAL ERROR")
    console.log(e.message)

  }

})()

http.createServer((req,res)=>{

  res.end("ok")

}).listen(process.env.PORT || 3000, ()=>{

  console.log("HTTP READY")

})
