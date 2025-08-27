require("dotenv").config()
const express = require("express")
const { Pool } = require("pg")
const http = require("http")
const { WebSocketServer } = require("ws")
const { createClient } = require("redis")

const {
  connectToRabbitMQ,
  checkPostgresConnection,
} = require("./utils/connections")

const PORT = 3000
const RABBITMQ_URL = process.env.RABBITMQ_URL
const REDIS_URL = process.env.REDIS_URL
const ORDERS_QUEUE_NAME = "orders_queue"
const DATABASE_URL = process.env.DATABASE_URL
let rabbitmqChannel
let isRabbitConnected = false

const app = express()

app.use(express.static("public"))

app.use(express.json())

const server = http.createServer(app)

const pool = new Pool({
  connectionString: DATABASE_URL,
})

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
    console.log(`Sent order ${newOrder.id} to queue`)

    res.status(201).json(newOrder)
  } catch (error) {
    console.error("Error creating order:", error)
    res.status(500).json({ error: "Internal Server Error" })
  }
})

app.get("/health", async (req, res) => {
  let httpStatus = 200
  const healthStatus = {
    status: "ok",
    services: {
      database: "ok",
      messageBroker: "ok",
    },
    timestamp: new Date().toISOString(),
  }

  try {
    await pool.query("SELECT 1")
  } catch (e) {
    healthStatus.services.database = "error"
    httpStatus = 503
  }

  if (!isRabbitConnected) {
    healthStatus.services.messageBroker = "error"
    httpStatus = 503
  }

  if (httpStatus !== 200) {
    healthStatus.status = "error"
  }

  res.status(httpStatus).json(healthStatus)
})

const wss = new WebSocketServer({ server })

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

async function manageRabbitMQConnection(attempt = 0) {
  const maxRetries = 10

  try {
    const connection = await connectToRabbitMQ(RABBITMQ_URL, () => {
      isRabbitConnected = false
      console.log("[!] Connection lost. Attempting to reconnect...")
      manageRabbitMQConnection()
    })

    rabbitmqChannel = await connection.createChannel()
    await rabbitmqChannel.assertQueue(ORDERS_QUEUE_NAME, { durable: true })
    isRabbitConnected = true
    console.log("RabbitMQ setup is complete.")
  } catch (error) {
    isRabbitConnected = false
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000
      console.error(
        `🔥 Connection attempt ${attempt + 1} failed. Retrying in ${(delay / 1000).toFixed(2)}s...`,
      )
      setTimeout(() => manageRabbitMQConnection(attempt + 1), delay)
    } else {
      console.error(
        "🔥 Could not connect to RabbitMQ after multiple retries. Exiting.",
      )
      process.exit(1)
    }
  }
}

async function startServer() {
  try {
    console.log("Starting server...")

    await checkPostgresConnection(DATABASE_URL)
    await manageRabbitMQConnection()

    server.listen(PORT, () => {
      console.log(`API Server & WebSocket running on http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error("Server failed to start:", error)
    process.exit(1)
  }
}

startServer()
