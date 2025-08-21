const DRIVER_ID = "93672337-208b-44fb-aa67-8be450ecdfe"
const WEBSOCKET_URL = `ws://localhost:3000/ws/track/${DRIVER_ID}`

const statusDiv = document.getElementById("status")
const mapDiv = document.getElementById("map")

const startCoordinates = [28.6139, 77.209]
const map = L.map(mapDiv).setView(startCoordinates, 13)
let driverMarker = null

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map)

console.log("Attempting to connect to WebSocket...")
const socket = new WebSocket(WEBSOCKET_URL)

socket.onopen = () => {
  statusDiv.textContent = "✅ Connected. Waiting for driver location..."
  console.log("WebSocket connection established")
}

socket.onmessage = (event) => {
  const location = JSON.parse(event.data)
  const { latitude, longitude } = location
  const latLng = [latitude, longitude]

  statusDiv.textContent = `Received: Lat ${latitude.toFixed(4)}, Lon ${longitude.toFixed(4)}`

  if (!driverMarker) {
    const driverIcon = L.icon({
      iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    })
    driverMarker = L.marker(latLng, { icon: driverIcon }).addTo(map)
    map.setView(latLng, 15)
  } else {
    driverMarker.setLatLng(latLng)
    map.panTo(latLng)
  }
}

socket.onclose = () => {
  statusDiv.textContent =
    "❌ Disconnected from server. Please refresh the page."
  console.log("WebSocket connection closed")
}

socket.onerror = (error) => {
  statusDiv.textContent = "❌ Error connecting to server."
  console.error("WebSocket Error:", error)
}
