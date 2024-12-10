import semver from 'semver';
import { execa, execaCommand } from 'execa';
import enq from 'enquirer';
import { parse, stringify } from 'yaml';

const { Select, prompt } = enq;

import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { readFile, writeFile } from 'node:fs/promises';

async function manual(description) {
  const rl = readline.createInterface({ input, output });
  await rl.question(`🧑‍💻 ${description} 

Press enter to continue...`);
  rl.close();
}

/**
 *
 * @param {string} description
 */
function automated(description) {
  console.log(`🤖 ${description}`);
}

/**
 *
 * @param {string} command
 * @param {boolean} dryRun
 */
function dryExeca(command, dryRun = true) {
  if (dryRun) {
    console.log(`🌵 Dry run: '${command}'`);
  } else {
    console.log(`🤖 Running command '${command}'`);
    return execaCommand(command, {
      preferLocal: true,
      stdout: 'inherit',
      stdin: 'inherit',
    });
  }
}

/**
 *
 * @param {string} file
 * @param {string} contents
 * @param {boolean} dryRun
 */
function dryWrite(file, contents, dryRun = true) {
  if (dryRun) {
    console.log(`🌵 Dry run: Updating the contents of '${file}' to be the following:

${contents}`);
  } else {
    return writeFile(file, contents, 'utf-8');
  }
}

/**
 *
 * @param {string} error
 */
function fatalError(error) {
  console.error(error);
  process.exit(1);
}

async function minimumNodeVersion(minVersion) {
  const { stdout: nodeVerison } = await execa`node --version`;

  if (!semver.gte(semver.clean(nodeVerison), semver.coerce(minVersion))) {
    console.error(
      `Guides can only be installed with node version greater than ${minVersion} and above right now. you have ${nodeVerison}`,
    );
    process.exit(1);
  }
}

async function ensureRepo(repo, branch, dryRun) {
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
    console.error(
      `It does not look like you are in the repo ${repo}. You can verify that you are by running 'git remote get-url origin'`,
    );
    process.exit(1);
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

export default async function guides(args, options) {
  await minimumNodeVersion(14);

  const dryRun = options.dryRun ?? false;

  await manual(
    'Check for pending PRs: https://github.com/ember-learn/guides-source/pulls',
  );
  await ensureRepo(
    'git@github.com:ember-learn/guides-source.git',
    'master',
    options.dryRun,
  );

  const selectPrompt = new Select({
    name: 'version',
    message: 'What kind of upgrade are we doing?',
    choices: ['minor', 'major'],
  });

  const version = await selectPrompt.run();

  const versionsFile = await parse(
    await readFile(`./guides/versions.yml`, 'utf-8'),
  );

  const currentVersion = versionsFile.currentVersion;
  const nextVersion = semver.inc(currentVersion, version);

  const tempBranch = nextVersion;
  automated(`Creating a new branch: ${tempBranch}`);
  await dryExeca(`git checkout -b ${tempBranch}`, dryRun);

  automated(`Removing any directories for ${currentVersion}`);
  await dryExeca(`rm -rf ./guides/${currentVersion}`, dryRun);
  automated(`Copying release to ${currentVersion}`);
  await dryExeca(`cp -r guides/release guides/${currentVersion}`, dryRun);

  automated(`Updating /guides/versions.yml`);

  versionsFile.allVersions.push(`v${nextVersion}`);
  versionsFile.currentVersion = `v${nextVersion}`;

  await dryWrite('./guides/versions.yml', stringify(versionsFile), dryRun);
  await manual(
    'Confirm that the ltsVerisons in ./guides/verisons.yml are correct',
  );

  const { emberDataCurrentVersion } = await prompt({
    type: 'input',
    name: 'emberDataCurrentVersion',
    message:
      'What version of EmberData is being released (e.g. 5.3.0)? Double check this as it might not be the same version as Ember.',
  });

  automated(
    `Updating version number for links in /guides/${currentVersion}/**/*.md`,
  );
  await dryExeca(
    `node ./scripts/update-version-links guides/${currentVersion} ${currentVersion.replace(/^v/, '')} ${semver.coerce(emberDataCurrentVersion)} --silent`,
    dryRun,
  );

  automated('Committing changes and publishing branch to remote');
  await dryExeca(`git add .`, dryRun);
  await dryExeca(`git commit -m "v${nextVersion}"`, dryRun);
  await dryExeca(`git push -u origin ${tempBranch}`, dryRun);

  await manual(
    `Create pull request for ${tempBranch}: https://github.com/ember-learn/guides-source/compare/master...${tempBranch}`,
  );

  await manual('Confirm new guides version is deployed before proceeding');
  await manual("You are super duper sure it's deployed?");

  console.log('success');
}
