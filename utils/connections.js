const amqp = require("amqplib")
const { Pool } = require("pg")

async function connectToRabbitMQ(RABBITMQ_URL, onClose) {
  let attempt = 0
  const maxRetries = 10

  while (attempt < maxRetries) {
    try {
      const connection = await amqp.connect(RABBITMQ_URL)
      console.log("✅ Connected to RabbitMQ")

      connection.on("close", () => {
        console.log("Rabbit connection closed")
        if (onClose) {
          onClose()
        }
      })

      return connection
    } catch (error) {
      attempt++
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000
      console.warn(
        `[!] RabbitMQ connection failed. Retrying in ${(delay / 1000).toFixed(2)}s...`,
      )

      if (attempt >= maxRetries) {
        console.error(
          "🔥 Failed to connect to RabbitMQ after multiple retries.",
          error,
        )
        process.exit(1)
      }
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}

async function checkPostgresConnection(DATABASE_URL) {
  let attempt = 0
  const maxRetries = 10
  const pool = new Pool({ connectionString: DATABASE_URL })

  while (attempt < maxRetries) {
    try {
      await pool.query("SELECT NOW()")
      console.log("✅ Connected to PostgreSQL")
      await pool.end()
      return
    } catch (error) {
      attempt++
      console.warn(
        `[!] PostgreSQL connection failed. Retrying... (${attempt}/${maxRetries})`,
      )
      if (attempt >= maxRetries) {
        console.error(
          "🔥 Failed to connect to PostgreSQL after multiple retries.",
          error,
        )
        process.exit(1)
      }
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }
}

module.exports = { connectToRabbitMQ, checkPostgresConnection }
