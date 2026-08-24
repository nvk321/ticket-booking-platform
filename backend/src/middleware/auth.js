const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

const requireTheatreAdmin = async (req, res, next) => {
  if (req.user.role === 'SUPER_ADMIN') return next();
  const theatreId = req.params.theatreId || req.body.theatreId;
  if (!theatreId) return res.status(400).json({ error: 'Theatre ID required' });
  const theatre = await prisma.theatre.findFirst({
    where: { id: theatreId, adminId: req.user.id },
  });
  if (!theatre) return res.status(403).json({ error: 'Not authorized for this theatre' });
  req.theatre = theatre;
  next();
};

module.exports = { authenticate, requireRole, requireTheatreAdmin };
