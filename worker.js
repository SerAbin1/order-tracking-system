const amqp = require("amqplib")
const { Pool } = require("pg")

// --- Database and RabbitMQ Connection Details ---
const RABBITMQ_URL = "amqp://myuser:mypassword@localhost:5672"
const QUEUE_NAME = "orders_queue"
const pool = new Pool({
  user: "myuser",
  host: "localhost",
  database: "orders_db",
  password: "mypassword",
  port: 5432,
})

async function processOrder(order) {
  console.log(`[⚙️] Processing order ${order.id}...`)

  // 1. Simulate work with a 5-second delay
  await new Promise((resolve) => setTimeout(resolve, 5000))

  // 2. Update the order status in the database
  const query = `UPDATE orders SET status = 'ACCEPTED' WHERE id = $1;`
  await pool.query(query, [order.id])

  console.log(`[✅] Order ${order.id} status updated to ACCEPTED.`)
}

async function startWorker() {
  try {
    // --- Connect to RabbitMQ ---
    const connection = await amqp.connect(RABBITMQ_URL)
    const channel = await connection.createChannel()
    await channel.assertQueue(QUEUE_NAME, { durable: true })

    // This tells RabbitMQ to only give us one message at a time.
    // It won't send a new message until we've acknowledged the previous one.
    channel.prefetch(1)
    console.log(
      `[👂] Worker is listening for messages in ${QUEUE_NAME}. To exit press CTRL+C`,
    )

    // --- Start Consuming Messages ---
    channel.consume(QUEUE_NAME, async (msg) => {
      if (msg !== null) {
        const order = JSON.parse(msg.content.toString())
        console.log(`[📥] Received order ${order.id}`)

        await processOrder(order)

        // Acknowledge the message
        // This is CRITICAL. It tells RabbitMQ the message has been
        // successfully processed and can be safely removed from the queue.
        channel.ack(msg)
      }
    })
  } catch (error) {
    console.error("🔥 Worker failed", error)
  }
}

startWorker()
