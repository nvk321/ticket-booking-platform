const router = require('express').Router();
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

// Get shows for a screen
router.get('/screen/:screenId', async (req, res) => {
  try {
    const { date } = req.query;
    // Use a 24-hour window from midnight UTC of the given date
    // Add ±1 day buffer to handle timezone differences
    const base = date ? new Date(date + 'T00:00:00.000Z') : new Date();
    base.setUTCHours(0, 0, 0, 0);
    const startOfDay = new Date(base.getTime() - 6 * 60 * 60 * 1000); // 6h before
    const endOfDay   = new Date(base.getTime() + 30 * 60 * 60 * 1000); // 30h after

    const shows = await prisma.show.findMany({
      where: {
        screenId: req.params.screenId,
        isActive: true,
        startTime: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        movie: true,
        screen: { include: { theatre: true } },
        _count: { select: { bookings: true } },
      },
      orderBy: { startTime: 'asc' },
    });
    res.json(shows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get shows for a movie across theatres
router.get('/movie/:movieId', async (req, res) => {
  try {
    const { date, city } = req.query;
    const base = date ? new Date(date + 'T00:00:00.000Z') : new Date();
    base.setUTCHours(0, 0, 0, 0);
    const startOfDay = new Date(base.getTime() - 6 * 60 * 60 * 1000);
    const endOfDay   = new Date(base.getTime() + 30 * 60 * 60 * 1000);

    const shows = await prisma.show.findMany({
      where: {
        movieId: req.params.movieId,
        isActive: true,
        startTime: { gte: startOfDay, lte: endOfDay },
        screen: { theatre: { isActive: true, ...(city && { city }) } },
      },
      include: {
        screen: { include: { theatre: true } },
        _count: { select: { bookings: true } },
      },
      orderBy: { startTime: 'asc' },
    });
    res.json(shows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get show with seat availability
router.get('/:id/seats', async (req, res) => {
  try {
    const show = await prisma.show.findUnique({
      where: { id: req.params.id },
      include: {
        screen: {
          include: {
            theatre: true,
            seats: {
              include: { seatType: true },
              orderBy: [{ row: 'asc' }, { col: 'asc' }],
            },
          },
        },
        movie: true,
      },
    });
    if (!show) return res.status(404).json({ error: 'Show not found' });

    // Get booked seats
    const bookedSeats = await prisma.bookingSeat.findMany({
      where: {
        booking: { showId: req.params.id, status: { in: ['CONFIRMED', 'PENDING'] } },
      },
      select: { seatId: true },
    });
    const bookedSeatIds = new Set(bookedSeats.map(b => b.seatId));

    // Get held seats
    const now = new Date();
    const heldSeats = await prisma.seatHold.findMany({
      where: { showId: req.params.id, expiresAt: { gt: now } },
      select: { seatId: true, sessionId: true, expiresAt: true },
    });
    const heldSeatMap = new Map(heldSeats.map(h => [h.seatId, h]));

    // Get screen pricing
    const pricing = await prisma.screenPricing.findMany({
      where: { screenId: show.screenId },
    });
    const pricingMap = new Map(pricing.map(p => [p.seatTypeId, p]));

    const seats = show.screen.seats.map(seat => {
      const held = heldSeatMap.get(seat.id);
      const seatPricing = pricingMap.get(seat.seatTypeId);
      return {
        ...seat,
        status: bookedSeatIds.has(seat.id)
          ? 'BOOKED'
          : held
          ? 'HELD'
          : seat.status === 'BLOCKED'
          ? 'BLOCKED'
          : 'AVAILABLE',
        heldBy: held?.sessionId,
        heldUntil: held?.expiresAt,
        price: seat.customPrice || seatPricing?.basePrice || 0,
      };
    });

    res.json({ ...show, screen: { ...show.screen, seats } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create show
router.post('/', authenticate, async (req, res) => {
  try {
    const { screenId, movieId, startTime, endTime, availableFrom, availableTo } = req.body;
    const screen = await prisma.screen.findUnique({
      where: { id: screenId },
      include: { theatre: true },
    });
    if (!screen) return res.status(404).json({ error: 'Screen not found' });
    if (screen.theatre.adminId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check for time conflicts on same screen
    const conflict = await prisma.show.findFirst({
      where: {
        screenId,
        isActive: true,
        OR: [
          { startTime: { lte: new Date(startTime) }, endTime: { gt: new Date(startTime) } },
          { startTime: { lt: new Date(endTime) }, endTime: { gte: new Date(endTime) } },
          { startTime: { gte: new Date(startTime) }, endTime: { lte: new Date(endTime) } },
        ],
      },
    });
    if (conflict) return res.status(400).json({ error: 'Show time conflicts with existing show on this screen' });

    const show = await prisma.show.create({
      data: { screenId, movieId, startTime: new Date(startTime), endTime: new Date(endTime), availableFrom: availableFrom ? new Date(availableFrom) : null, availableTo: availableTo ? new Date(availableTo) : null },
      include: { movie: true, screen: true },
    });
    res.status(201).json(show);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle show active
router.patch('/:id/toggle', authenticate, async (req, res) => {
  try {
    const show = await prisma.show.findUnique({
      where: { id: req.params.id },
      include: { screen: { include: { theatre: true } } },
    });
    if (!show) return res.status(404).json({ error: 'Show not found' });
    if (show.screen.theatre.adminId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const updated = await prisma.show.update({
      where: { id: req.params.id },
      data: { isActive: !show.isActive },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
