// Creates an admin user, or resets the password of an existing one.
// Usage (from back/): npm run create-admin
// Runs only on the server, against MONGO_URI from .env; there is deliberately
// no HTTP endpoint for this.
import readline from 'readline';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/User.model';

dotenv.config({ quiet: true });

const MIN_PASSWORD_LENGTH = 10;

function ask(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    // Echo nothing while the password is typed.
    (rl as any)._writeToOutput = (s: string) => {
      if (s.startsWith(question)) process.stdout.write(question);
    };
  }
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    })
  );
}

(async () => {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set in .env');

  const email = (await ask('Email: ')).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email');

  const password = await ask(`Password (at least ${MIN_PASSWORD_LENGTH} characters): `, true);
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error('Password is too short');
  if ((await ask('Repeat password: ', true)) !== password) throw new Error('Passwords do not match');

  await mongoose.connect(process.env.MONGO_URI);
  const hashed = await bcrypt.hash(password, 10);
  const existing = await User.findOne({ email });
  if (existing) {
    existing.password = hashed;
    await existing.save();
    console.log(`Password updated for ${email}`);
  } else {
    await User.create({ email, password: hashed, role: 'admin' });
    console.log(`Admin created: ${email}`);
  }
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error('Failed:', err.message);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
