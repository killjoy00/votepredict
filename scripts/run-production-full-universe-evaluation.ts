import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parseRuntimeEnvironment } from '../src/operations/environment-file.js';

function main(): void {
  const path = process.env.VOTEPREDICT_PRODUCTION_ENV_FILE;
  if (!path) throw new Error('Production environment file is required');

  const parsed = parseRuntimeEnvironment(readFileSync(path, 'utf8'));
  const databaseUrl = parsed.DATABASE_URL_UNPOOLED || parsed.DATABASE_URL;
  if (!databaseUrl) throw new Error('Production database URL is unavailable');

  for (const value of [parsed.DATABASE_URL_UNPOOLED, parsed.DATABASE_URL].filter((value): value is string => Boolean(value))) {
    console.log(`::add-mask::${value.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
  }

  const env = {
    ...process.env,
    DATABASE_URL_UNPOOLED: parsed.DATABASE_URL_UNPOOLED || databaseUrl,
    DATABASE_URL: parsed.DATABASE_URL || databaseUrl,
  };

  for (const command of [
    ['npm', ['run', 'db:migrate']],
    ['npm', ['run', 'eval:full-universe-stage']],
  ] as const) {
    const result = spawnSync(command[0], command[1], { env, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command[0]} ${command[1].join(' ')} exited with ${result.status}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted database URL]') : String(error));
  process.exitCode = 1;
}
