/**
 * Set a new password for one Joshi Safa House login, from this computer.
 *
 * For the case nothing else covers: nobody can sign in, so nobody can open
 * Admin → Users to fix it. Whoever has the app installed can run
 *
 *   npm run reset-password
 *
 * and type a username and a new password. The password is never shown on
 * screen, never written to a file, and nothing else about the account
 * changes. No other account is touched or printed.
 */

import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

// A plain node script does not get .env the way Next does.
function loadEnv() {
  if (process.env.DATABASE_URL) return;
  try {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // No .env file — the variable has to come from the environment instead.
  }
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

/** Reads a line without echoing it, so the password never appears on screen. */
function askSecret(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    let value = '';
    const onData = (chunk) => {
      const char = chunk.toString('utf8');
      if (char === '\n' || char === '\r' || char === '\u0004') {
        if (process.stdin.isTTY) process.stdin.setRawMode(wasRaw ?? false);
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(value);
      } else if (char === '\u0003') {
        process.stdout.write('\n');
        process.exit(1);
      } else if (char === '\u007f' || char === '\b') {
        value = value.slice(0, -1);
      } else {
        value += char;
      }
    };
    process.stdin.on('data', onData);
  });
}

loadEnv();

if (!process.env.DATABASE_URL) {
  console.error('\nDATABASE_URL is not set, so this script cannot reach the database.');
  console.error('Run it from the folder that holds the app, where the .env file lives.\n');
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  console.log('\nJoshi Safa House — set a new password\n');
  const identifier = (await ask('Username or email: ')).trim();
  if (!identifier) throw new Error('No username given.');

  let user;
  try {
    user = await prisma.user.findFirst({
      where: { OR: [{ username: identifier }, { email: identifier }] },
      select: { id: true, name: true, username: true, role: true },
    });
  } catch {
    console.error('\nCould not reach the database. Check this computer\u2019s internet connection');
    console.error('and try again — nothing was changed.\n');
    process.exit(1);
  }

  if (!user) {
    console.error(`\nNo account with the username or email "${identifier}".`);
    console.error('Check the spelling — it is the same one typed on the sign-in screen.\n');
    process.exit(1);
  }

  console.log(`\nAccount found: ${user.name} (${user.role}).`);

  const password = await askSecret('New password (not shown as you type): ');
  if (password.trim().length < 6) throw new Error('Use at least 6 characters.');
  const again = await askSecret('Type it once more: ');
  if (password !== again) throw new Error('The two passwords are not the same. Nothing was changed.');

  await prisma.user.update({ where: { id: user.id }, data: { password: password.trim() } });

  console.log(`\nDone. ${user.name} can sign in with the new password now.`);
  console.log('Nothing else about the account was changed.\n');
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
} finally {
  rl.close();
  await prisma.$disconnect();
}
