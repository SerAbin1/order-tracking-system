require("dotenv").config()
const { Pool } = require("pg")

const { connectToRabbitMQ } = require("./utils/connections")

const RABBITMQ_URL = process.env.RABBITMQ_URL
const QUEUE_NAME = "orders_queue"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

async function processOrder(order) {
  console.log(`[⚙️] Processing order ${order.id}...`)

  await new Promise((resolve) => setTimeout(resolve, 5000))

  const query = `UPDATE orders SET status = 'ACCEPTED' WHERE id = $1;`
  await pool.query(query, [order.id])

  console.log(`[✅] Order ${order.id} status updated to ACCEPTED.`)
}

async function startWorker() {
  try {
    const connection = await connectToRabbitMQ(RABBITMQ_URL)
    const channel = await connection.createChannel()
    await channel.assertQueue(QUEUE_NAME, { durable: true })

    channel.prefetch(1)
    console.log(
      `[👂] Worker is listening for messages in ${QUEUE_NAME}. To exit press CTRL+C`,
    )

    channel.consume(QUEUE_NAME, async (msg) => {
      if (msg !== null) {
        const order = JSON.parse(msg.content.toString())
        console.log(`[📥] Received order ${order.id}`)

        await processOrder(order)

        channel.ack(msg)
      }
    })
  } catch (error) {
    console.error("🔥 Worker failed", error)
  }
}

startWorker()
