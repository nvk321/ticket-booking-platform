const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

// Create booking
router.post('/', authenticate, async (req, res) => {
  const { showId, seatIds, sessionId } = req.body;
  if (!showId || !seatIds?.length) return res.status(400).json({ error: 'showId and seatIds required' });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const show = await tx.show.findUnique({
        where: { id: showId },
        include: { screen: { include: { theatre: true } } },
      });
      if (!show || !show.isActive) throw new Error('Show not available');

      // Verify seats belong to this screen
      const seats = await tx.seat.findMany({
        where: { id: { in: seatIds }, screenId: show.screenId },
        include: { seatType: true },
      });
      if (seats.length !== seatIds.length) throw new Error('Invalid seats for this show');

      // Check for already booked seats
      const alreadyBooked = await tx.bookingSeat.findMany({
        where: {
          seatId: { in: seatIds },
          booking: { showId, status: { in: ['CONFIRMED', 'PENDING'] } },
        },
      });
      if (alreadyBooked.length > 0) throw new Error('Some seats are already booked');

      // Check holds — only allow if held by this session
      const now = new Date();
      const holds = await tx.seatHold.findMany({
        where: { seatId: { in: seatIds }, showId, expiresAt: { gt: now } },
      });
      const foreignHolds = holds.filter(h => h.sessionId !== sessionId);
      if (foreignHolds.length > 0) throw new Error('Some seats are held by another session');

      // Get pricing
      const pricing = await tx.screenPricing.findMany({ where: { screenId: show.screenId } });
      const pricingMap = new Map(pricing.map(p => [p.seatTypeId, p]));

      const isWeekend = [0, 6].includes(new Date(show.startTime).getDay());
      const isPeak = new Date(show.startTime).getHours() >= 18;

      let totalAmount = 0;
      const bookingSeats = seats.map(seat => {
        const p = pricingMap.get(seat.seatTypeId);
        let price = seat.customPrice || p?.basePrice || 0;
        if (isWeekend && p?.weekendPrice) price = p.weekendPrice;
        if (isPeak && p?.peakPrice) price = Math.max(price, p.peakPrice);
        totalAmount += price;
        return { seatId: seat.id, price };
      });

      const bookingRef = 'BK' + Date.now().toString(36).toUpperCase() + uuidv4().slice(0, 4).toUpperCase();

      const booking = await tx.booking.create({
        data: {
          bookingRef,
          totalAmount,
          status: 'CONFIRMED',
          userId: req.user.id,
          showId,
          seats: { create: bookingSeats },
          payment: {
            create: { amount: totalAmount, status: 'SUCCESS', gateway: 'MOCK' },
          },
        },
        include: {
          seats: { include: { seat: { include: { seatType: true } } } },
          show: { include: { movie: true, screen: { include: { theatre: true } } } },
          user: { select: { name: true, email: true } },
        },
      });

      // Generate QR code
      const qrData = JSON.stringify({ bookingRef, showId, seats: seatIds });
      const qrCode = await QRCode.toDataURL(qrData);
      await tx.booking.update({ where: { id: booking.id }, data: { qrCode } });

      // Release holds
      await tx.seatHold.deleteMany({ where: { seatId: { in: seatIds }, showId } });

      return { ...booking, qrCode };
    });

    // Emit real-time update
    req.io.to(`show:${showId}`).emit('seats:booked', {
      showId,
      seatIds,
      screenId: result.show.screenId,
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get user bookings
router.get('/my', authenticate, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user.id },
      include: {
        seats: { include: { seat: { include: { seatType: true } } } },
        show: { include: { movie: true, screen: { include: { theatre: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get booking by ref
router.get('/:ref', authenticate, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { bookingRef: req.params.ref },
      include: {
        seats: { include: { seat: { include: { seatType: true } } } },
        show: { include: { movie: true, screen: { include: { theatre: true } } } },
        user: { select: { name: true, email: true } },
        payment: true,
      },
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.userId !== req.user.id && req.user.role === 'USER') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    res.json(booking);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel booking
router.patch('/:id/cancel', authenticate, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.userId !== req.user.id && req.user.role === 'USER') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (booking.status === 'CANCELLED') return res.status(400).json({ error: 'Already cancelled' });

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id: req.params.id },
        data: { status: 'CANCELLED' },
      });
      await tx.payment.update({
        where: { bookingId: req.params.id },
        data: { status: 'REFUNDED' },
      });
      return b;
    });

    req.io.to(`show:${booking.showId}`).emit('seats:released', {
      showId: booking.showId,
      bookingId: booking.id,
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
