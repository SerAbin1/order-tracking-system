require("dotenv").config()

const { connectToRabbitMQ } = require("./utils/connections")

const RABBITMQ_URL = process.env.RABBITMQ_URL
const QUEUE_NAME = "gps_updates_queue"

const DRIVER_ID = process.env.DRIVER_ID
const UPDATE_INTERVAL_MS = 1000
let rabbitChannel

let currentLocation = {
  latitude: 16.9891,
  longitude: 82.2475,
}

function getNextLocation() {
  currentLocation.latitude += Math.random() * 0.001
  currentLocation.longitude += Math.random() * 0.001
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
    `Sent Location for driver ${DRIVER_ID}: Lat ${newLocation.latitude.toFixed(4)}, Lon ${newLocation.longitude.toFixed(4)}`,
  )
}

async function startSimulator(attempt = 0) {
  const maxRetries = 10

  if (attempt == 0) {
    console.log("--- Driver Simulator Started ---")
    if (!DRIVER_ID) {
      console.error("Error: DRIVER_ID not found in .env file.")
      process.exit(1)
    }
  }

  try {
    const connection = await connectToRabbitMQ(RABBITMQ_URL, () => {
      if (updateInterval) clearInterval(updateInterval)
      console.log("Attempting simulator reconnection")
      startSimulator()
    })

    rabbitChannel = await connection.createChannel()
    await rabbitChannel.assertQueue(QUEUE_NAME, { durable: true })
    console.log("Simulator connected to RabbitMQ")

    console.log(
      `--- Sending updates for driver ${DRIVER_ID} every ${UPDATE_INTERVAL_MS / 1000} seconds ---`,
    )
    updateInterval = setInterval(() => {
      sendLocationUpdate(rabbitChannel)
    }, UPDATE_INTERVAL_MS)
  } catch (error) {
    if (updateInterval) clearInterval(updateInterval)

    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000
      setTimeout(() => startSimulator(attempt + 1), delay)
    } else {
      console.error("Failed to start simulator:", error)
      process.exit(1)
    }
  }
}

let updateInterval = null
startSimulator()
