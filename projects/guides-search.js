import ensureRepo from './lib/ensure-repo.js';
import { readdir, readFile } from 'node:fs/promises';
import { parse, stringify } from 'yaml';
import { automated } from './lib/log.js';
import { dryExeca } from './lib/dry-execa.js';
import enq from 'enquirer';
import dryWrite from './lib/dry-write.js';

const { Invisible } = enq;

export default async function guides(args, options) {
  const dryRun = options.dryRun ?? false;

  await ensureRepo(
    'git@github.com:ember-learn/guides-source.git',
    'master',
    dryRun,
  );

  const versionsFile = await parse(
    await readFile(`./guides/versions.yml`, 'utf-8'),
  );
  const currentVersion = versionsFile.currentVersion;

  automated('Removing guides.');
  const guidesFolders = await readdir('./guides');
  for (let folder of guidesFolders) {
    if (folder.startsWith('v')) {
      await dryExeca(`rm -rf ./guides/${folder}`, dryRun);
    }
  }

  automated('Removing pre-built guides.');
  const publicFolders = await readdir('./public');
  for (let folder of publicFolders) {
    if (folder.startsWith('v')) {
      await dryExeca(`rm -rf ./public/${folder}`, dryRun);
    }
  }

  const keyPrompt = new Invisible({
    name: 'apiKey',
    message: `Go to https://dashboard.algolia.com/account/api-keys/all?applicationId=Y1OMR4C7MF"
Copy the Write API Key with the copy button beside the obfuscated key and paste it below (note it won't seem like you're pasting)`,
  });

  const apiKey = await keyPrompt.run();

  automated('Writing ./config/credentials.json');
  dryWrite(
    `./config/credentials.json`,
    `{
  "algoliaKey": "${apiKey}",
  "algoliaIndex": "ember-guides",
  "algoliaApplication": "Y1OMR4C7MF"
}`,
    dryRun,
  );

  automated('Pruning allVersions in ./guides/versions.yml');
  versionsFile.allVersions = [currentVersion];
  dryWrite('./guides/versions.yml', stringify(versionsFile), dryRun);

  const deployConfig = await readFile('./config/deploy.js', 'utf-8');

  automated('Deleting versionsToIgnore in ./config/deploy.js');
  dryWrite(
    './config/deploy.js',
    deployConfig.replace(/versionsToIgnore.*/, ''),
    dryRun,
  );

  // echo
  automated('Deleting dist folder');
  await dryExeca('rm -rf dist', dryRun);

  // echo
  automated('Deleting tmp folder');
  await dryExeca('rm -rf tmp', dryRun);

  // echo
  automated('Deploying');
  await dryExeca('pnpm i', dryRun);
  await dryExeca('ember deploy production', dryRun);

  automated('Restoring branch.');
  await dryExeca('git reset --hard', dryRun);
}
