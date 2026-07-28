import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { issueToken } from '../src/middleware/auth.js';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Ensure JWT_SECRET is set
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = crypto.randomBytes(64).toString('hex');
    console.log(`\n⚠️  WARNING: JWT_SECRET was not set. Using a temporary secret for this script run:`);
    console.log(`JWT_SECRET=${process.env.JWT_SECRET}\n`);
  }

  // Create or update a test tenant
  const email = 'admin@example.com';
  const passwordHash = await bcrypt.hash('password123', 10);
  
  const tenant = await prisma.tenant.upsert({
    where: { email },
    update: { passwordHash },
    create: {
      name: 'Test Tenant',
      email,
      passwordHash,
    },
  });

  console.log('✅ Test Tenant created/updated:');
  console.log(`   ID: ${tenant.id}`);
  console.log(`   Email: ${tenant.email}`);
  
  // Generate a JWT for this tenant
  const token = issueToken(tenant.id);
  
  console.log('\n🔐 Auth Token (Bearer Token) for API requests:');
  console.log(`Bearer ${token}`);
  console.log('\nSave this token to use in your API requests!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
