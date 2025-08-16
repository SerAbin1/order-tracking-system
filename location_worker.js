require("dotenv").config()
const amqp = require("amqplib")
const { createClient } = require("redis")

const RABBITMQ_URL = process.env.RABBITMQ_URL
const REDIS_URL = process.env.REDIS_URL
const GPS_QUEUE_NAME = "gps_updates_queue"

let redisClient

async function processMessages(message) {
  const { driver_id, location } = message
  console.log(`Recieved GPS update fr driver ${driver_id}`)

  await new Promise((resolve) => setTimeout(resolve, 0))

  const locationKey = `driver:location:${driver_id}`
  await redisClient.set(locationKey, JSON.stringify(location))

  const channelName = `driver_updates:${driver_id}`
  await redisClient.publish(channelName, JSON.stringify(location))

  console.log(`Processed update for driver ${driver_id}`)
}

async function startWorker() {
  console.log("starting location worker....")
  let rabbitmqChannel

  try {
    const rabbitmqConnection = await amqp.connect(RABBITMQ_URL)
    rabbitmqChannel = await rabbitmqConnection.createChannel()
    await rabbitmqChannel.assertQueue(GPS_QUEUE_NAME, { durable: true })
    rabbitmqChannel.prefetch(1)
    console.log("Connected to RabbitMQ")

    redisClient = createClient({ url: REDIS_URL })
    await redisClient.connect()
    console.log("Connected to Redis")

    console.log(`Worker listening for messages in ${GPS_QUEUE_NAME}`)

    rabbitmqChannel.consume(GPS_QUEUE_NAME, async (msg) => {
      if (msg != null) {
        const message = JSON.parse(msg.content.toString())

        await processMessages(message)

        rabbitmqChannel.ack(msg)
      }
    })
  } catch (error) {
    console.log("Location worker failed", error)
    process.exit(1)
  }
}

startWorker()
