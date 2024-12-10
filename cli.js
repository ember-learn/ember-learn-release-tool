#!/usr/bin/env node
import { program } from 'commander';
import { readFile } from 'fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { join } from 'path';

const pkg = JSON.parse(
  await readFile(join(dirname(fileURLToPath(import.meta.url)), 'package.json')),
);

import guides from './projects/guides.js';
import guidesSearch from './projects/guides-search.js';

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version)
  .option(
    '--dry-run',
    'Run the deploy pipeline without actually deploying. Useful for understanding all the necessary steps, or when working on the pipeline itself',
  );

program
  .command('guides')
  .description('Deploy the new version for https://guides.emberjs.com')
  .action((args, commandOptions) =>
    guides(args, {
      ...program.opts(),
      ...commandOptions,
    }),
  );

program
  .command('guides-search')
  .description('Update Algolia indexes for https://guides.emberjs.com')
  .action((args, commandOptions) =>
    guidesSearch(args, {
      ...program.opts(),
      ...commandOptions,
    }),
  );

program.parse();
