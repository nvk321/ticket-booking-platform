const router = require('express').Router();
const prisma = require('../lib/prisma');
const { authenticate, requireRole } = require('../middleware/auth');

// Get all theatres (public)
router.get('/', async (req, res) => {
  try {
    const { city } = req.query;
    const theatres = await prisma.theatre.findMany({
      where: { isActive: true, ...(city && { city }) },
      include: {
        screens: { where: { isActive: true }, select: { id: true, name: true, capacity: true } },
        _count: { select: { screens: true } },
      },
    });
    res.json(theatres);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single theatre
router.get('/:id', async (req, res) => {
  try {
    const theatre = await prisma.theatre.findUnique({
      where: { id: req.params.id },
      include: {
        screens: {
          where: { isActive: true },
          include: {
            _count: { select: { seats: true, shows: true } },
          },
        },
      },
    });
    if (!theatre) return res.status(404).json({ error: 'Theatre not found' });
    res.json(theatre);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create theatre (admin)
router.post('/', authenticate, requireRole('SUPER_ADMIN', 'THEATRE_ADMIN'), async (req, res) => {
  try {
    const { name, description, address, city, state, country, phone, email, logoUrl, primaryColor, accentColor } = req.body;
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();

    const theatre = await prisma.theatre.create({
      data: { name, slug, description, address, city, state, country, phone, email, logoUrl, primaryColor, accentColor, adminId: req.user.id },
    });
    res.status(201).json(theatre);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update theatre
router.put('/:id', authenticate, async (req, res) => {
  try {
    const theatre = await prisma.theatre.findUnique({ where: { id: req.params.id } });
    if (!theatre) return res.status(404).json({ error: 'Theatre not found' });
    if (theatre.adminId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = await prisma.theatre.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get my theatres
router.get('/admin/mine', authenticate, async (req, res) => {
  try {
    const theatres = await prisma.theatre.findMany({
      where: req.user.role === 'SUPER_ADMIN' ? {} : { adminId: req.user.id },
      include: {
        screens: { include: { _count: { select: { seats: true, shows: true } } } },
        _count: { select: { screens: true } },
      },
    });
    res.json(theatres);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
