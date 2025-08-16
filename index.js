require('dotenv').config()
const express = require("express")
const { Pool } = require("pg")
const amqp = require("amqplib") // Import the new library

const app = express()
app.use(express.json())

const pool = new Pool({
  user: "myuser",
  host: "localhost",
  database: "orders_db",
  password: "mypassword",
  port: 5432,
})

// ---- NEW: RabbitMQ Connection Logic ----
let channel
const RABBITMQ_URL = process.env.RABBITMQ_URL
const QUEUE_NAME = "orders_queue"

async function connectToRabbitMQ() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL)
    channel = await connection.createChannel()
    await channel.assertQueue(QUEUE_NAME, { durable: true })
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

    // ---- NEW: Publish message to RabbitMQ ----
    const message = JSON.stringify(newOrder)
    channel.sendToQueue(QUEUE_NAME, Buffer.from(message), { persistent: true })
    console.log(`✅ Sent order ${newOrder.id} to exchange`)
    // --------------------------------------------

    res.status(201).json(newOrder)
  } catch (error) {
    console.error("🔥 Error creating order:", error)
    res.status(500).json({ error: "Internal Server Error" })
  }
})

const PORT = 3000
app.listen(PORT, () => {
  console.log(`API Server running on http://localhost:${PORT}`)
  connectToRabbitMQ() // Connect to RabbitMQ when the server starts
})
