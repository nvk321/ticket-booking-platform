const router = require('express').Router();
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

// Theatre overview analytics
router.get('/theatre/:theatreId', authenticate, async (req, res) => {
  try {
    const { theatreId } = req.params;
    const theatre = await prisma.theatre.findUnique({ where: { id: theatreId } });
    if (!theatre) return res.status(404).json({ error: 'Theatre not found' });
    if (theatre.adminId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const screens = await prisma.screen.findMany({
      where: { theatreId },
      include: {
        seats: true,
        shows: {
          include: {
            bookings: {
              where: { status: 'CONFIRMED' },
              include: { seats: true, payment: true },
            },
          },
        },
      },
    });

    const screenAnalytics = screens.map(screen => {
      const totalSeats = screen.seats.length;
      let totalRevenue = 0;
      let totalBookings = 0;
      let totalBookedSeats = 0;

      screen.shows.forEach(show => {
        show.bookings.forEach(booking => {
          totalRevenue += booking.payment?.amount || 0;
          totalBookings++;
          totalBookedSeats += booking.seats.length;
        });
      });

      const occupancyRate = totalSeats > 0
        ? ((totalBookedSeats / (totalSeats * screen.shows.length || 1)) * 100).toFixed(1)
        : 0;

      return {
        screenId: screen.id,
        screenName: screen.name,
        totalSeats,
        totalShows: screen.shows.length,
        totalBookings,
        totalRevenue,
        occupancyRate: parseFloat(occupancyRate),
      };
    });

    const totalRevenue = screenAnalytics.reduce((s, a) => s + a.totalRevenue, 0);
    const totalBookings = screenAnalytics.reduce((s, a) => s + a.totalBookings, 0);
    const totalSeats = screenAnalytics.reduce((s, a) => s + a.totalSeats, 0);

    res.json({
      theatreId,
      theatreName: theatre.name,
      totalScreens: screens.length,
      totalSeats,
      totalRevenue,
      totalBookings,
      screens: screenAnalytics,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Screen-level analytics
router.get('/screen/:screenId', authenticate, async (req, res) => {
  try {
    const screen = await prisma.screen.findUnique({
      where: { id: req.params.screenId },
      include: {
        theatre: true,
        seats: { include: { seatType: true } },
        shows: {
          include: {
            movie: true,
            bookings: {
              where: { status: 'CONFIRMED' },
              include: { seats: { include: { seat: true } }, payment: true },
            },
          },
          orderBy: { startTime: 'desc' },
          take: 20,
        },
      },
    });
    if (!screen) return res.status(404).json({ error: 'Screen not found' });
    if (screen.theatre.adminId !== req.user.id && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Seat utilization heatmap
    const seatBookingCount = new Map();
    screen.shows.forEach(show => {
      show.bookings.forEach(booking => {
        booking.seats.forEach(bs => {
          seatBookingCount.set(bs.seatId, (seatBookingCount.get(bs.seatId) || 0) + 1);
        });
      });
    });

    const heatmap = screen.seats.map(seat => ({
      seatId: seat.id,
      label: seat.label,
      row: seat.row,
      col: seat.col,
      bookingCount: seatBookingCount.get(seat.id) || 0,
    }));

    // Show performance
    const showPerformance = screen.shows.map(show => ({
      showId: show.id,
      movie: show.movie.title,
      startTime: show.startTime,
      totalBookings: show.bookings.length,
      revenue: show.bookings.reduce((s, b) => s + (b.payment?.amount || 0), 0),
      seatsBooked: show.bookings.reduce((s, b) => s + b.seats.length, 0),
    }));

    res.json({
      screen: { id: screen.id, name: screen.name, capacity: screen.capacity },
      heatmap,
      showPerformance,
      totalRevenue: showPerformance.reduce((s, p) => s + p.revenue, 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
