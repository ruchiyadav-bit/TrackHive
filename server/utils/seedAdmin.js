const User = require('../models/User');
const { MANAGER } = require('../config/roles');

const seedAdmin = async () => {
  try {
    const existingAdmin = await User.findOne({ role: MANAGER });
    if (existingAdmin) return;

    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      console.warn('Skipping admin seed: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
      return;
    }

    const admin = new User({
      name: 'Manager',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: MANAGER,
      status: 'active',
      offerAccess: 'all',
    });

    await admin.save();
    console.log(`Manager account seeded: ${admin.email}`);
  } catch (error) {
    console.error('Error seeding admin:', error.message);
  }
};

module.exports = { seedAdmin };
