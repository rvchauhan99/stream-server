require('./polyfills');
require('dotenv').config();

const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || process.env.SERVER_PORT || 5141;
const router = require("./router");
const path = require("path");
const connectDB = require("./library/db");
const mongoose = require("mongoose");
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const LoginSession = require('./models/loginSession');
const User = require('./models/user');

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000")
  .split(',')
  .map(origin => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const corsOrigin = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ""))) {
    return callback(null, true);
  }
  return callback(new Error(`CORS blocked for origin: ${origin}`));
};

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
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
  origin: corsOrigin,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  if (typeof req.body === 'undefined') {
    req.body = {};
  }
  next();
});
app.set('trust proxy', true);
app.use(express.static(path.join(__dirname, "public")));
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use(router);

app.get('/health', async (req, res) => {
  const mongoOk = mongoose.connection.readyState === 1;
  const status = mongoOk ? 'ok' : 'degraded';
  const code = mongoOk ? 200 : 503;
  res.status(code).json({
    status,
    time: new Date().toISOString(),
    mongo: mongoOk ? 'up' : 'down',
  });
});

io.use(async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) {
      return next(new Error('Unauthorized'));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.isActive === false) {
      return next(new Error('Unauthorized'));
    }
    if (!decoded.sessionId) {
      return next(new Error('Unauthorized'));
    }
    const session = await LoginSession.findOne({
      user: user._id,
      sessionId: decoded.sessionId,
    });
    if (!session) {
      return next(new Error('Unauthorized'));
    }
    socket.user = user;
    socket.sessionId = decoded.sessionId;
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id, 'user:', socket.user?._id?.toString());

  // Clients may only join rooms scoped to their own user id or upload socket id they own
  socket.on('join', (roomId) => {
    if (typeof roomId !== 'string' || roomId.length > 128) return;
    const uid = socket.user._id.toString();
    if (roomId === uid || roomId.startsWith(`${uid}:`) || roomId.startsWith('upload:')) {
      socket.join(roomId);
    }
  });
});

async function start() {
  try {
    if (!process.env.JWT_SECRET?.trim()) {
      throw new Error('JWT_SECRET is required');
    }
    if (!process.env.TOKEN_AUTH_KEY?.trim() || !process.env.BUNNY_LIBRARY_ID?.trim()) {
      throw new Error('TOKEN_AUTH_KEY and BUNNY_LIBRARY_ID are required');
    }
    await connectDB();
    console.log('Database connected');
    server.listen(port, '0.0.0.0', () => {
      console.log(`Server listening on port ${port}`);
    });
  } catch (error) {
    console.log('Error while starting server', error.message);
    process.exit(1);
  }
}
start();
