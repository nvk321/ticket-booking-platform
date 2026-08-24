const router = require('express').Router();
const prisma = require('../lib/prisma');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const movies = await prisma.movie.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const movie = await prisma.movie.findUnique({
      where: { id: req.params.id },
      include: {
        shows: {
          where: { isActive: true, startTime: { gte: new Date() } },
          include: { screen: { include: { theatre: true } } },
          orderBy: { startTime: 'asc' },
        },
      },
    });
    if (!movie) return res.status(404).json({ error: 'Movie not found' });
    res.json(movie);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, requireRole('SUPER_ADMIN', 'THEATRE_ADMIN'), async (req, res) => {
  try {
    const movie = await prisma.movie.create({ data: req.body });
    res.status(201).json(movie);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authenticate, requireRole('SUPER_ADMIN', 'THEATRE_ADMIN'), async (req, res) => {
  try {
    const movie = await prisma.movie.update({ where: { id: req.params.id }, data: req.body });
    res.json(movie);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
