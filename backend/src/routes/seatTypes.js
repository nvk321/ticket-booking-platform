const router = require('express').Router();
const prisma = require('../lib/prisma');
const { authenticate, requireRole } = require('../middleware/auth');

// Get all seat types
router.get('/', async (_req, res) => {
  try {
    const types = await prisma.seatType.findMany({ orderBy: { name: 'asc' } });
    res.json(types);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create seat type
router.post('/', authenticate, requireRole('SUPER_ADMIN', 'THEATRE_ADMIN'), async (req, res) => {
  try {
    const { name, color, description } = req.body;
    if (!name || !color) return res.status(400).json({ error: 'name and color required' });
    const existing = await prisma.seatType.findUnique({ where: { name } });
    if (existing) return res.status(400).json({ error: 'Seat type name already exists' });
    const type = await prisma.seatType.create({ data: { name, color, description } });
    res.status(201).json(type);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update seat type
router.put('/:id', authenticate, requireRole('SUPER_ADMIN', 'THEATRE_ADMIN'), async (req, res) => {
  try {
    const { name, color, description } = req.body;
    const type = await prisma.seatType.update({
      where: { id: req.params.id },
      data: { name, color, description },
    });
    res.json(type);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete seat type (only if no seats use it)
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'THEATRE_ADMIN'), async (req, res) => {
  try {
    const inUse = await prisma.seat.count({ where: { seatTypeId: req.params.id } });
    if (inUse > 0) return res.status(400).json({ error: `Cannot delete — ${inUse} seats use this type` });
    await prisma.seatType.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
