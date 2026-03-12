const express = require("express");
const app = express();
const cors = require("cors");
const port = 3000;
const router = require("./router");
const path = require("path");
const connectDB = require("./library/db");
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust as per your frontend
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});


require("./utils/croneJobs");
app.use(cors());
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

