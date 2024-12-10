import semver from 'semver';
import { execa } from 'execa';
import enq from 'enquirer';
import { parse, stringify } from 'yaml';

const { Select, prompt } = enq;

import { readFile } from 'node:fs/promises';

import ensureRepo from './lib/ensure-repo.js';
import { automated, fatalError, manual } from './lib/log.js';
import { dryExeca } from './lib/dry-execa.js';
import dryWrite from './lib/dry-write.js';

async function minimumNodeVersion(minVersion) {
  const { stdout: nodeVerison } = await execa`node --version`;

  if (!semver.gte(semver.clean(nodeVerison), semver.coerce(minVersion))) {
    fatalError(
      `Guides can only be installed with node version greater than ${minVersion} and above right now. you have ${nodeVerison}`,
    );
  }
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

  // TODO this should be pulled into this release scirpt rather than shelling out with execa
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
