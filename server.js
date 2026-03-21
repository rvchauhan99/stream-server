require('dotenv').config();
const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.SERVER_PORT || 5141;
const router = require("./router");
const path = require("path");
const connectDB = require("./library/db");
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:3002,http://127.0.0.1:3002")
  .split(',')
  .map(origin => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => callback(null, true), // Allow everything
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});


require("./utils/croneJobs");
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url} | Origin: ${req.get('origin') || 'no-origin'}`);
  next();
});
app.use(cors({
  origin: (origin, callback) => callback(null, true), // Allow everything
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true
}));
app.use(express.json());
app.use((req, res, next) => {
  if (typeof req.body === 'undefined') {
    req.body = {}; 
  }
  next();
});
app.set('trust proxy', true);
// Serve static files from /public
app.use(express.static(path.join(__dirname, "public")));
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use(router)

io.on('connection', (socket) => {
  console.log('⚡ New socket connected:', socket.id);

  socket.on("join", (socketId) => {
    socket.join(socketId);
    console.log(`✅ Socket ${socket.id} joined room: ${socketId}`);
  });
});

async function start() {
  try {
    await connectDB();
    console.log("Database connected");
    server.listen(port, () => {
      console.log(`Example app listening on port ${port}`);
    });
    require("./load")
    // const Video = require('./models/video');
    // let videos = await Video.find({});
    // console.log(videos);

    setInterval(() => {
      io.to("1234").emit("upload-progress", {
        videoId: "test123",
        percentage: (Math.random() * 100).toFixed(2),
      });
    }, 500);

  } catch (error) {
    console.log("Error while starting server", error.message);
  }
}
start();  

