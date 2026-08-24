const prisma = require('../lib/prisma');

const HOLD_DURATION_MS = 5 * 60 * 1000; // 5 minutes

function setupSocketHandlers(io) {
  // Cleanup expired holds every 30 seconds
  setInterval(async () => {
    try {
      const expired = await prisma.seatHold.findMany({
        where: { expiresAt: { lt: new Date() } },
        select: { id: true, seatId: true, showId: true },
      });
      if (expired.length > 0) {
        await prisma.seatHold.deleteMany({ where: { expiresAt: { lt: new Date() } } });
        // Group by showId and notify
        const byShow = expired.reduce((acc, h) => {
          if (!acc[h.showId]) acc[h.showId] = [];
          acc[h.showId].push(h.seatId);
          return acc;
        }, {});
        Object.entries(byShow).forEach(([showId, seatIds]) => {
          io.to(`show:${showId}`).emit('seats:holdExpired', { showId, seatIds });
        });
      }
    } catch (err) {
      console.error('Hold cleanup error:', err.message);
    }
  }, 30000);

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join a show room to receive real-time seat updates
    socket.on('show:join', ({ showId }) => {
      socket.join(`show:${showId}`);
      socket.emit('show:joined', { showId });
    });

    socket.on('show:leave', ({ showId }) => {
      socket.leave(`show:${showId}`);
    });

    // Hold seats
    socket.on('seats:hold', async ({ showId, seatIds, sessionId }, callback) => {
      try {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + HOLD_DURATION_MS);

        // Check if seats are available
        const booked = await prisma.bookingSeat.findMany({
          where: {
            seatId: { in: seatIds },
            booking: { showId, status: { in: ['CONFIRMED', 'PENDING'] } },
          },
        });
        if (booked.length > 0) {
          return callback?.({ success: false, error: 'Some seats are already booked' });
        }

        const existingHolds = await prisma.seatHold.findMany({
          where: { seatId: { in: seatIds }, showId, expiresAt: { gt: now } },
        });
        const foreignHolds = existingHolds.filter(h => h.sessionId !== sessionId);
        if (foreignHolds.length > 0) {
          return callback?.({ success: false, error: 'Some seats are held by another user' });
        }

        // Upsert holds
        await prisma.$transaction(
          seatIds.map(seatId =>
            prisma.seatHold.upsert({
              where: { seatId_showId: { seatId, showId } },
              update: { sessionId, expiresAt },
              create: { seatId, showId, sessionId, expiresAt },
            })
          )
        );

        // Notify room
        io.to(`show:${showId}`).emit('seats:held', {
          showId,
          seatIds,
          sessionId,
          expiresAt,
        });

        callback?.({ success: true, expiresAt });
      } catch (err) {
        callback?.({ success: false, error: err.message });
      }
    });

    // Release holds
    socket.on('seats:release', async ({ showId, seatIds, sessionId }, callback) => {
      try {
        await prisma.seatHold.deleteMany({
          where: { seatId: { in: seatIds }, showId, sessionId },
        });

        io.to(`show:${showId}`).emit('seats:released', { showId, seatIds });
        callback?.({ success: true });
      } catch (err) {
        callback?.({ success: false, error: err.message });
      }
    });

    // Admin: watch screen live
    socket.on('screen:watch', ({ screenId }) => {
      socket.join(`screen:${screenId}`);
    });

    socket.on('disconnect', async () => {
      // Release all holds for this socket's session
      try {
        const sessionId = socket.id;
        const holds = await prisma.seatHold.findMany({
          where: { sessionId },
          select: { seatId: true, showId: true },
        });
        if (holds.length > 0) {
          await prisma.seatHold.deleteMany({ where: { sessionId } });
          const byShow = holds.reduce((acc, h) => {
            if (!acc[h.showId]) acc[h.showId] = [];
            acc[h.showId].push(h.seatId);
            return acc;
          }, {});
          Object.entries(byShow).forEach(([showId, seatIds]) => {
            io.to(`show:${showId}`).emit('seats:released', { showId, seatIds });
          });
        }
      } catch (err) {
        console.error('Disconnect cleanup error:', err.message);
      }
    });
  });
}

module.exports = { setupSocketHandlers };
