# Order Tracking Simulation

A microservices based order tracking system with a message queue (RabbitMQ), caching (Redis), real-time connection (WebSockets), and PostgreSQL.

The driver coordinates is produced by the _simulator.js_, which acts as the delivery agent and is forwarded to the RabbitMQ queue _gps_orders_queue_. It is consumed by the _location_worker.js_ and sent to the Redis channel of the particular driver. When a client is connected, the Web Socket server subscribes to the relevant Redis Pub/Sub channel and the message is sent to the connected client, which is used to update the marker in the UI.

The `/api/orders` endpoint can be used to place an order in the. It will be consumed from the RabbitMQ queue `orders_queue` by the _order_worker.js_.

Note: I built this purely to learn these technologies, and as such some services are not really needed or isn't integrated into the whole (e.g., PostgresSQL and order placement has no effect on the driver!)

## Prerequisites

Before you begin, ensure you have the following installed:

- [Node.js](https://nodejs.org/en/)
- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Usage

This project can be run in two ways: using Docker (single command) or by running the Node.js services manually.

### Docker

1.  **Set up the environment variables:**

    Create a `.env.docker` file in the root of the project. You can copy the example file as a starting point:

    ```bash
    cp .env.example .env.docker
    ```

    Then, edit the `.env.docker` file and provide the correct connection strings for the Docker environment. The following values should work:

    ```
    DATABASE_URL=postgres://myuser:mypassword@postgres:5432/orders_db
    RABBITMQ_URL=amqp://myuser:mypassword@rabbitmq:5672
    REDIS_URL=redis://redis:6379
    DRIVER_ID=93672337-208b-44fb-aa67-8be450ecdfe
    ```

2.  **Start the services:**

    ```bash
    docker-compose up
    ```

    This will build the Docker images and start all the services. The API server will be available at `http://localhost:3000`.

### Node.js

1.  **Start the background services:**

    You need to have PostgreSQL, RabbitMQ, and Redis running. You can use Docker to easily start these services:

    ```bash
    docker-compose up -d postgres rabbitmq redis
    ```

    Or start them manually.

2.  **Set up the environment variables:**

    Create a `.env` file in the root of the project. You can copy the example file as a starting point:

    ```bash
    cp .env.example .env
    ```

    Then, edit the `.env` file and provide the correct connection strings for your local environment. For the Docker-based services started in the previous step, the following values should work:

    ```
    DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/orders_db
    RABBITMQ_URL=amqp://myuser:mypassword@localhost:5672
    REDIS_URL=redis://localhost:6379
    DRIVER_ID=93672337-208b-44fb-aa67-8be450ecdfe
    ```

3.  **Install dependencies:**

    ```bash
    npm install
    ```

4.  **Start the services:**

    You'll need to open separate terminal windows for each service:

    ```bash
    node index.js

    node simulator.js

    node location_worker.js

    node order_worker.js
    ```
