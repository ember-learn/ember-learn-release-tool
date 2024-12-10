import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

/**
 *
 * @param {string} description
 */
export function automated(description) {
  console.log(`🤖 ${description}`);
}

/**
 *
 * @param {string} error
 */
export function fatalError(error) {
  console.error(error);
  process.exit(1);
}

export async function manual(description) {
  const rl = readline.createInterface({ input, output });
  await rl.question(`🧑‍💻 ${description} 

Press enter to continue...`);
  rl.close();
}
