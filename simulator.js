require("dotenv").config()

const { connectToRabbitMQ } = require("./utils/connections")

const RABBITMQ_URL = process.env.RABBITMQ_URL
const QUEUE_NAME = "gps_updates_queue"

const DRIVER_ID = process.env.DRIVER_ID
const UPDATE_INTERVAL_MS = 3000
let rabbitChannel

let currentLocation = {
  latitude: 28.6139,
  longitude: 77.209,
}

function getNextLocation() {
  currentLocation.latitude += (Math.random() - 0.5) * 0.001
  currentLocation.longitude += (Math.random() - 0.5) * 0.001
  return currentLocation
}

async function sendLocationUpdate() {
  const newLocation = getNextLocation()
  const message = {
    driver_id: DRIVER_ID,
    location: newLocation,
    timestamp: new Date().toISOString(),
  }

  const messageBuffer = Buffer.from(JSON.stringify(message))
  rabbitChannel.sendToQueue(QUEUE_NAME, messageBuffer, { persistent: true })

  console.log(
    `[🚚] Sent Location for driver ${DRIVER_ID}: Lat ${newLocation.latitude.toFixed(4)}, Lon ${newLocation.longitude.toFixed(4)}`,
  )
}

async function startSimulator() {
  console.log("--- Driver Simulator Started ---")
  if (!DRIVER_ID) {
    console.error("🔥 Error: DRIVER_ID not found in .env file.")
    process.exit(1)
  }

  try {
    const connection = await connectToRabbitMQ(RABBITMQ_URL)
    rabbitChannel = await connection.createChannel()
    await rabbitChannel.assertQueue(QUEUE_NAME, { durable: true })
    console.log("✅ Simulator connected to RabbitMQ")

    connection.on("close", () => {
      console.error("🔥 RabbitMQ connection closed!")
      process.exit(1)
    })

    console.log(
      `--- Sending updates for driver ${DRIVER_ID} every ${UPDATE_INTERVAL_MS / 1000} seconds ---`,
    )
    setInterval(() => {
      sendLocationUpdate(rabbitChannel)
    }, UPDATE_INTERVAL_MS)
  } catch (error) {
    console.error("🔥 Failed to start simulator:", error)
    process.exit(1)
  }
}

startSimulator()
