import { writeFile } from 'node:fs/promises';
/**
 *
 * @param {string} file
 * @param {string} contents
 * @param {boolean} dryRun
 */
export default function dryWrite(file, contents, dryRun = true) {
  if (dryRun) {
    console.log(`🌵 Dry run: Updating the contents of '${file}' to be the following:

${contents}`);
  } else {
    return writeFile(file, contents, 'utf-8');
  }
}
