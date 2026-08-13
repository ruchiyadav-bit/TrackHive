const User = require('../models/User');

const seedAdmin = async () => {
  try {
    const existingAdmin = await User.findOne({ role: 'super_admin' });
    if (existingAdmin) return;

    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      console.warn('Skipping admin seed: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env');
      return;
    }

    const admin = new User({
      name: 'Super Admin',
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      role: 'super_admin',
      status: 'active',
      offerAccess: 'all',
    });

    await admin.save();
    console.log(`Super admin seeded: ${admin.email}`);
  } catch (error) {
    console.error('Error seeding admin:', error.message);
  }
};

module.exports = { seedAdmin };
