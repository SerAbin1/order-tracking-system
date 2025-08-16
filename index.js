require("dotenv").config()
const express = require("express")
const { Pool } = require("pg")
const amqp = require("amqplib")
const http = require("http")
const { WebSocketServer } = require("ws")
const { createClient } = require("redis")
const { channel } = require("diagnostics_channel")

const app = express()
app.use(express.json())

const server = http.createServer(app)

const pool = new Pool({
  user: "myuser",
  host: "localhost",
  database: "orders_db",
  password: "mypassword",
  port: 5432,
})

let rabbitmqChannel
const RABBITMQ_URL = process.env.RABBITMQ_URL
const ORDERS_QUEUE_NAME = "orders_queue"

async function connectToRabbitMQ() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL)
    rabbitmqChannel = await connection.createChannel()
    await rabbitmqChannel.assertQueue(ORDERS_QUEUE_NAME, { durable: true })
    console.log("✅ Connected to RabbitMQ")
  } catch (error) {
    console.error("🔥 Failed to connect to RabbitMQ", error)
    process.exit(1) // Exit if we can't connect
  }
}
// -----------------------------------------

app.post("/api/orders", async (req, res) => {
  try {
    const { customer_id, restaurant_id, items, total_price } = req.body
    if (!customer_id || !restaurant_id || !items) {
      return res.status(400).json({ error: "Missing required fields." })
    }

    const query = `
            INSERT INTO orders (customer_id, restaurant_id, items, total_price)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `
    const values = [
      customer_id,
      restaurant_id,
      JSON.stringify(items),
      total_price,
    ]

    const result = await pool.query(query, values)
    const newOrder = result.rows[0]

    const message = JSON.stringify(newOrder)
    rabbitmqChannel.sendToQueue(ORDERS_QUEUE_NAME, Buffer.from(message), {
      persistent: true,
    })
    console.log(`✅ Sent order ${newOrder.id} to exchange`)
    // --------------------------------------------

    res.status(201).json(newOrder)
  } catch (error) {
    console.error("🔥 Error creating order:", error)
    res.status(500).json({ error: "Internal Server Error" })
  }
})

const wss = new WebSocketServer({ server })
const REDIS_URL = process.env.REDIS_URL

wss.on("connection", async (ws, req) => {
  console.log("New client connected")

  const urlParts = req.url.split("/")
  if (
    urlParts.length !== 4 ||
    urlParts[1] !== "ws" ||
    urlParts[2] !== "track"
  ) {
    ws.close(1008, "Invalid URL format")
    return
  }
  const driverId = urlParts[3]
  const channelName = `driver_updates:${driverId}`

  const subscriber = createClient({ url: REDIS_URL })
  await subscriber.connect()

  console.log(`Client tracking driver ${driverId} on channel ${channelName}`)

  await subscriber.subscribe(channelName, (message) => {
    ws.send(message)
  })

  ws.on("close", () => {
    console.log("[🔌] Client disconnected")
    subscriber.unsubscribe(channelName)
    subscriber.quit()
  })

  ws.on("error", (error) => {
    console.error("WebSocket error:", error)
  })
})

const PORT = 3000
server.listen(PORT, () => {
  console.log(`API Server & WebSocket running on http://localhost:${PORT}`)
  connectToRabbitMQ()
})
