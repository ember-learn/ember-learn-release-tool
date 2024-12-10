import { execa } from 'execa';

import { fatalError, automated } from './log.js';
import { dryExeca } from './dry-execa.js';

export default async function ensureRepo(repo, branch, dryRun) {
  let stdout;

  try {
    let result = await execa`git remote get-url origin`;
    stdout = result.stdout;
  } catch (err) {
    fatalError(
      `Error checking current remote: [${err.message}]. Make sure you are in the cloned folder for ${repo}`,
    );
  }

  if (repo !== stdout) {
    fatalError(
      `It does not look like you are in the repo ${repo}. You can verify that you are by running 'git remote get-url origin'`,
    );
  }

  let { stdout: cleanDir } = await execa`git status --porcelain`;

  if (cleanDir.length) {
    fatalError(`Make sure you are in a clean working directory. You can verify this by making sure 'git status --porcelain' returns nothign.

Current response: 
${cleanDir}`);
  }

  let { stdout: currentBranch } = await execa`git rev-parse --abbrev-ref HEAD`;
  if (currentBranch !== branch) {
    fatalError(
      `Make sure you are on the '${branch}' branch. You are currently on '${currentBranch}'`,
    );
  }

  automated('Pulling latest changes from origin');
  await dryExeca('git pull', dryRun);
}
