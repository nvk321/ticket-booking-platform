const router = require('express').Router();
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

// Get screens for a theatre
router.get('/theatre/:theatreId', async (req, res) => {
  try {
    const screens = await prisma.screen.findMany({
      where: { theatreId: req.params.theatreId, isActive: true },
      include: {
        _count: { select: { seats: true, shows: true } },
      },
    });
    res.json(screens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single screen with seats
router.get('/:id', async (req, res) => {
  try {
    const screen = await prisma.screen.findUnique({
      where: { id: req.params.id },
      include: {
        seats: { include: { seatType: true }, orderBy: [{ row: 'asc' }, { col: 'asc' }] },
        theatre: true,
        _count: { select: { shows: true } },
      },
    });
    if (!screen) return res.status(404).json({ error: 'Screen not found' });
    res.json(screen);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create screen
router.post('/', authenticate, async (req, res) => {
  try {
    const { theatreId, name, capacity, rows, cols } = req.body;
    const theatre = await prisma.theatre.findUnique({ where: { id: theatreId } });
    if (!theatre) return res.status(404).json({ error: 'Theatre not found' });
    if (theatre.adminId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const screen = await prisma.screen.create({
      data: { theatreId, name, capacity, rows: rows || 20, cols: cols || 30 },
    });
    res.status(201).json(screen);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update screen
router.put('/:id', authenticate, async (req, res) => {
  try {
    const screen = await prisma.screen.findUnique({
      where: { id: req.params.id },
      include: { theatre: true },
    });
    if (!screen) return res.status(404).json({ error: 'Screen not found' });
    if (screen.theatre.adminId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await prisma.screen.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save seat layout for a screen
router.post('/:id/layout', authenticate, async (req, res) => {
  try {
    const { seats } = req.body; // Array of seat configs
    const screen = await prisma.screen.findUnique({
      where: { id: req.params.id },
      include: { theatre: true },
    });
    if (!screen) return res.status(404).json({ error: 'Screen not found' });
    if (screen.theatre.adminId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete existing seats and recreate
    await prisma.$transaction(async (tx) => {
      await tx.seat.deleteMany({ where: { screenId: req.params.id } });
      if (seats && seats.length > 0) {
        await tx.seat.createMany({ data: seats.map(s => ({ ...s, screenId: req.params.id })) });
      }
      await tx.screen.update({
        where: { id: req.params.id },
        data: { capacity: seats?.length || 0 },
      });
    });

    const updatedScreen = await prisma.screen.findUnique({
      where: { id: req.params.id },
      include: { seats: { include: { seatType: true }, orderBy: [{ row: 'asc' }, { col: 'asc' }] } },
    });
    res.json(updatedScreen);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get pricing for a screen
router.get('/:id/pricing', async (req, res) => {
  try {
    const pricing = await prisma.screenPricing.findMany({
      where: { screenId: req.params.id },
      include: { },
    });
    res.json(pricing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Set pricing for a screen
router.post('/:id/pricing', authenticate, async (req, res) => {
  try {
    const { pricingList } = req.body; // [{ seatTypeId, basePrice, weekendPrice, peakPrice }]
    const screen = await prisma.screen.findUnique({
      where: { id: req.params.id },
      include: { theatre: true },
    });
    if (!screen) return res.status(404).json({ error: 'Screen not found' });
    if (screen.theatre.adminId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const results = await prisma.$transaction(
      pricingList.map(p =>
        prisma.screenPricing.upsert({
          where: { screenId_seatTypeId: { screenId: req.params.id, seatTypeId: p.seatTypeId } },
          update: { basePrice: p.basePrice, weekendPrice: p.weekendPrice, peakPrice: p.peakPrice },
          create: { screenId: req.params.id, seatTypeId: p.seatTypeId, basePrice: p.basePrice, weekendPrice: p.weekendPrice, peakPrice: p.peakPrice },
        })
      )
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
