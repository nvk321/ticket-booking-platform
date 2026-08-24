const router = require('express').Router();

router.use('/auth', require('./auth'));
router.use('/theatres', require('./theatres'));
router.use('/screens', require('./screens'));
router.use('/movies', require('./movies'));
router.use('/shows', require('./shows'));
router.use('/bookings', require('./bookings'));
router.use('/analytics', require('./analytics'));
router.use('/seat-types', require('./seatTypes'));

module.exports = router;
