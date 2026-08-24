require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('./lib/prisma');

async function main() {
  console.log('🌱 Seeding database...');

  // Seat types — real-world multiplex categories
  const seatTypes = await Promise.all([
    prisma.seatType.upsert({ where: { name: 'Second Class' }, update: { color: '#6b7280', description: 'Standard economy seating' }, create: { name: 'Second Class', color: '#6b7280', description: 'Standard economy seating' } }),
    prisma.seatType.upsert({ where: { name: 'First Class' }, update: { color: '#3b82f6', description: 'First class with extra legroom' }, create: { name: 'First Class', color: '#3b82f6', description: 'First class with extra legroom' } }),
    prisma.seatType.upsert({ where: { name: 'Balcony' }, update: { color: '#8b5cf6', description: 'Upper balcony — elevated view' }, create: { name: 'Balcony', color: '#8b5cf6', description: 'Upper balcony — elevated view' } }),
    prisma.seatType.upsert({ where: { name: 'Royal' }, update: { color: '#f59e0b', description: 'Royal recliner seats — best experience' }, create: { name: 'Royal', color: '#f59e0b', description: 'Royal recliner seats — best experience' } }),
  ]);
  console.log('✅ Seat types created');

  // Admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@theatre.com' },
    update: {},
    create: { email: 'admin@theatre.com', password: adminPassword, name: 'Theatre Admin', role: 'THEATRE_ADMIN' },
  });

  // Regular user
  const userPassword = await bcrypt.hash('user123', 10);
  await prisma.user.upsert({
    where: { email: 'user@theatre.com' },
    update: {},
    create: { email: 'user@theatre.com', password: userPassword, name: 'John Doe', role: 'USER' },
  });
  console.log('✅ Users created');

  // Theatre
  const theatre = await prisma.theatre.upsert({
    where: { slug: 'cineplex-mumbai' },
    update: {},
    create: {
      name: 'CinePlex Mumbai',
      slug: 'cineplex-mumbai',
      description: 'Premium multiplex experience',
      address: '123 Film Street, Andheri West',
      city: 'Mumbai',
      state: 'Maharashtra',
      adminId: admin.id,
      primaryColor: '#e11d48',
      accentColor: '#f59e0b',
    },
  });
  console.log('✅ Theatre created');

  // Screens
  const screen1 = await prisma.screen.upsert({
    where: { theatreId_name: { theatreId: theatre.id, name: 'Audi 1' } },
    update: {},
    create: { theatreId: theatre.id, name: 'Audi 1', capacity: 0, rows: 10, cols: 15 },
  });
  const screen2 = await prisma.screen.upsert({
    where: { theatreId_name: { theatreId: theatre.id, name: 'Audi 2' } },
    update: {},
    create: { theatreId: theatre.id, name: 'Audi 2', capacity: 0, rows: 8, cols: 12 },
  });
  console.log('✅ Screens created');

  // Generate seats for Screen 1 (10 rows x 15 cols)
  // Layout: rows 0-1 = Royal, rows 2-4 = Balcony, rows 5-9 = First Class
  // Aisle at col 7. Best View seats at sweet-spot rows 3-4, cols 5-9
  const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const screen1Seats = [];
  for (let r = 0; r < 10; r++) {
    let colCounter = 1;
    for (let c = 0; c < 15; c++) {
      if (c === 7) continue; // aisle gap
      let seatTypeId;
      if (r < 2) seatTypeId = seatTypes[3].id;       // Royal (rows A-B)
      else if (r < 5) seatTypeId = seatTypes[2].id;  // Balcony (rows C-E)
      else seatTypeId = seatTypes[1].id;              // First Class (rows F-J)

      // Best View: center seats in Balcony rows (sweet spot)
      const isBestView = (r === 3 || r === 4) && c >= 5 && c <= 9;
      screen1Seats.push({
        screenId: screen1.id,
        row: r, col: c,
        label: `${rowLabels[r]}${colCounter}`,
        rowLabel: rowLabels[r],
        seatTypeId,
        isGolden: isBestView,
        customPrice: isBestView ? 480 : null,
      });
      colCounter++;
    }
  }
  await prisma.seat.deleteMany({ where: { screenId: screen1.id } });
  await prisma.seat.createMany({ data: screen1Seats });
  await prisma.screen.update({ where: { id: screen1.id }, data: { capacity: screen1Seats.length } });

  // Generate seats for Screen 2 (8 rows x 12 cols)
  // Layout: rows 0-1 = Royal, rows 2-4 = Balcony, rows 5-7 = Second Class
  // Aisle at col 6. Best View: rows 2-3, cols 4-8
  const screen2Seats = [];
  for (let r = 0; r < 8; r++) {
    let colCounter = 1;
    for (let c = 0; c < 12; c++) {
      if (c === 6) continue; // aisle
      let seatTypeId;
      if (r < 2) seatTypeId = seatTypes[3].id;       // Royal
      else if (r < 5) seatTypeId = seatTypes[2].id;  // Balcony
      else seatTypeId = seatTypes[0].id;              // Second Class

      const isBestView = (r === 2 || r === 3) && c >= 4 && c <= 8;
      screen2Seats.push({
        screenId: screen2.id,
        row: r, col: c,
        label: `${rowLabels[r]}${colCounter}`,
        rowLabel: rowLabels[r],
        seatTypeId,
        isGolden: isBestView,
        customPrice: isBestView ? 550 : null,
      });
      colCounter++;
    }
  }
  await prisma.seat.deleteMany({ where: { screenId: screen2.id } });
  await prisma.seat.createMany({ data: screen2Seats });
  await prisma.screen.update({ where: { id: screen2.id }, data: { capacity: screen2Seats.length } });
  console.log('✅ Seats created');

  // Pricing
  await prisma.screenPricing.deleteMany({ where: { screenId: { in: [screen1.id, screen2.id] } } });
  await prisma.screenPricing.createMany({
    data: [
      // Screen 1
      { screenId: screen1.id, seatTypeId: seatTypes[1].id, basePrice: 200, weekendPrice: 260, peakPrice: 280 }, // First Class
      { screenId: screen1.id, seatTypeId: seatTypes[2].id, basePrice: 350, weekendPrice: 430, peakPrice: 460 }, // Balcony
      { screenId: screen1.id, seatTypeId: seatTypes[3].id, basePrice: 550, weekendPrice: 680, peakPrice: 720 }, // Royal
      // Screen 2
      { screenId: screen2.id, seatTypeId: seatTypes[0].id, basePrice: 150, weekendPrice: 190, peakPrice: 210 }, // Second Class
      { screenId: screen2.id, seatTypeId: seatTypes[2].id, basePrice: 380, weekendPrice: 460, peakPrice: 500 }, // Balcony
      { screenId: screen2.id, seatTypeId: seatTypes[3].id, basePrice: 600, weekendPrice: 750, peakPrice: 800 }, // Royal
    ],
  });
  console.log('✅ Pricing created');

  // Movies
  const movies = await Promise.all([
    prisma.movie.upsert({
      where: { id: 'movie-1' },
      update: {},
      create: { id: 'movie-1', title: 'Interstellar 2', description: 'A journey beyond the stars', duration: 169, genre: ['Sci-Fi', 'Drama'], language: 'English', rating: 'U/A', posterUrl: 'https://picsum.photos/seed/movie1/300/450' },
    }),
    prisma.movie.upsert({
      where: { id: 'movie-2' },
      update: {},
      create: { id: 'movie-2', title: 'Dune: Part Three', description: 'The final chapter of the epic saga', duration: 155, genre: ['Sci-Fi', 'Action'], language: 'English', rating: 'U/A', posterUrl: 'https://picsum.photos/seed/movie2/300/450' },
    }),
    prisma.movie.upsert({
      where: { id: 'movie-3' },
      update: {},
      create: { id: 'movie-3', title: 'Pathaan 2', description: 'The spy returns', duration: 145, genre: ['Action', 'Thriller'], language: 'Hindi', rating: 'U/A', posterUrl: 'https://picsum.photos/seed/movie3/300/450' },
    }),
  ]);
  console.log('✅ Movies created');

  // Shows (today + tomorrow)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const showTimes = [
    { hour: 9, min: 0 }, { hour: 13, min: 0 }, { hour: 17, min: 0 }, { hour: 21, min: 0 },
  ];

  await prisma.show.deleteMany({ where: { screenId: { in: [screen1.id, screen2.id] } } });

  for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
    const day = new Date(today);
    day.setDate(day.getDate() + dayOffset);

    for (let i = 0; i < showTimes.length; i++) {
      const start = new Date(day);
      start.setHours(showTimes[i].hour, showTimes[i].min, 0, 0);
      const movie = movies[i % movies.length];
      const end = new Date(start.getTime() + movie.duration * 60000 + 15 * 60000);

      await prisma.show.create({
        data: { screenId: screen1.id, movieId: movie.id, startTime: start, endTime: end },
      });
    }

    for (let i = 0; i < 3; i++) {
      const start = new Date(day);
      start.setHours(showTimes[i + 1].hour, showTimes[i + 1].min, 0, 0);
      const movie = movies[(i + 1) % movies.length];
      const end = new Date(start.getTime() + movie.duration * 60000 + 15 * 60000);

      await prisma.show.create({
        data: { screenId: screen2.id, movieId: movie.id, startTime: start, endTime: end },
      });
    }
  }
  console.log('✅ Shows created');

  console.log('\n🎬 Seed complete!');
  console.log('Admin: admin@theatre.com / admin123');
  console.log('User:  user@theatre.com / user123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
