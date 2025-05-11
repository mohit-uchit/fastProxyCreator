import { MongoClient, ServerApiVersion } from "mongodb"

const uri = process.env.MONGODB_URI || ""
const dbName = process.env.MONGODB_DB || "squid-proxy"

let client: MongoClient
let clientPromise: Promise<MongoClient>

if (!uri) {
  throw new Error("Please add your MongoDB URI to .env.local")
}

if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>
  }

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    })
    globalWithMongo._mongoClientPromise = client.connect()
  }
  clientPromise = globalWithMongo._mongoClientPromise
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  })
  clientPromise = client.connect()
}

export { clientPromise, dbName }
