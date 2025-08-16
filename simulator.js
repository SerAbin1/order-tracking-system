require("dotenv").config()
const amqp = require("amqplib")
const crypto = require("crypto")

const RABBITMQ_URL = process.env.RABBITMQ_URL
const QUEUE_NAME = "gps_updates_queue" // A new queue just for GPS data

// We'll use the ID of the sample driver we inserted into the database
const DRIVER_ID = process.env.DRIVER_ID // Replace with your actual driver UUID if different
const UPDATE_INTERVAL_MS = 3000 // Send an update every 3 seconds

// --- SIMULATION LOGIC ---
let currentLocation = {
  latitude: 28.6139, // Starting in New Delhi
  longitude: 77.209,
}

function getNextLocation() {
  // Simulate slight random movement
  currentLocation.latitude += (Math.random() - 0.5) * 0.001
  currentLocation.longitude += (Math.random() - 0.5) * 0.001
  return currentLocation
}

async function sendLocationUpdate() {
  let connection, channel
  try {
    // --- CONNECT & SEND ---
    connection = await amqp.connect(RABBITMQ_URL)
    channel = await connection.createChannel()
    await channel.assertQueue(QUEUE_NAME, { durable: true })

    const newLocation = getNextLocation()
    const message = {
      driver_id: DRIVER_ID,
      location: newLocation,
      timestamp: new Date().toISOString(),
    }

    const messageBuffer = Buffer.from(JSON.stringify(message))
    channel.sendToQueue(QUEUE_NAME, messageBuffer, { persistent: true })

    console.log(
      `[🚚] Sent Location for driver ${DRIVER_ID}: Lat ${newLocation.latitude.toFixed(4)}, Lon ${newLocation.longitude.toFixed(4)}`,
    )
  } catch (error) {
    console.error("🔥 Error in simulator:", error)
  } finally {
    // --- CLEANUP ---
    if (channel) await channel.close()
    if (connection) await connection.close()
  }
}

// --- MAIN EXECUTION ---
console.log("--- Driver Simulator Started ---")
console.log(
  `--- Sending updates for driver ${DRIVER_ID} every ${UPDATE_INTERVAL_MS / 1000} seconds ---`,
)
setInterval(sendLocationUpdate, UPDATE_INTERVAL_MS)
