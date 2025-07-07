import { execaCommand } from 'execa';

/**
 *
 * @param {string} command
 * @param {boolean} dryRun
 */
export function dryExeca(command, dryRun = true, options) {
  if (dryRun) {
    console.log(`🌵 Dry run: '${command}'`);
  } else {
    console.log(`🤖 Running command '${command}'`);
    return execaCommand(command, {
      preferLocal: true,
      stdout: 'inherit',
      stdin: 'inherit',
      ...options,
    });
  }
}
