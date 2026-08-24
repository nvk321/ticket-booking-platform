require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { setupSocketHandlers } = require('./socket/handlers');
const routes = require('./routes');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Attach io to req
app.use((req, _res, next) => {
  req.io = io;
  next();
});

app.use('/api', routes);

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

setupSocketHandlers(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🎫 TicketFlow backend running on port ${PORT}`);
});

module.exports = { app, io };
