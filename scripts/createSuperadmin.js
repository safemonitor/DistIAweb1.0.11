// Script to create a superadmin account
const { createSuperAdmin } = require('../src/lib/auth');

// Superadmin credentials
const email = 'admin@distria.com';
const password = '123456';
const firstName = 'Super';
const lastName = 'Admin';

async function createSuperAdminAccount() {
  try {
    console.log('Creating superadmin account...');
    const result = await createSuperAdmin(email, password, firstName, lastName);
    console.log('Superadmin account created successfully!');
    console.log('Email:', email);
    console.log('User ID:', result.user.id);
  } catch (error) {
    console.error('Error creating superadmin account:', error.message);
  }
}

createSuperAdminAccount();