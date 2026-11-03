import { adminAccounts } from './admins.mjs';
import { randomBytes,scryptSync } from 'node:crypto';
import { openDatabase } from './local-db.mjs';
const input=(process.argv[2]||'').trim().toLowerCase();
const name=adminAccounts.get(input) || (['akai','hoor'].includes(input) ? input : undefined);
if(!['akai','hoor'].includes(name)) throw Error('Usage: node account.mjs <authorized-email> [--demo]');
if(!process.stdin.isTTY) throw Error('Run from an interactive terminal to set a hidden password.');
process.stdout.write('New password for '+name+' (12 or more characters, input hidden): ');
process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
let password='';
for await(const chunk of process.stdin) {
  let done=false;
  for(const c of chunk) {
    if(c==='\u0003') process.exit(130);
    if(c==='\r'||c==='\n') { done=true;break; }
    if(c==='\b'||c==='\u007f') password=password.slice(0,-1);
    else if(c>=' ') password+=c;
  }
  if(done) break;
}
process.stdout.write('\n');
if(password.length<12 || password.length>256) throw Error('Use a password between 12 and 256 characters.');
const db=openDatabase(process.argv.includes('--demo')),salt=randomBytes(16).toString('hex');
const hash=scryptSync(password,salt,64).toString('hex');
db.exec('BEGIN IMMEDIATE');
db.prepare('INSERT OR REPLACE INTO accounts VALUES(?,?,?)').run(name,salt,hash);
db.prepare('DELETE FROM sessions WHERE name=?').run(name);
db.exec('COMMIT');
db.close();
console.log('Password saved. Previous sessions for this account were revoked.');
