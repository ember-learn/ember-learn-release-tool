import { execa } from 'execa';

import { readFile, cp } from 'node:fs/promises';
import fs from 'fs';

import ensureOnePassword from './lib/ensure-one-password.js';
import { automated } from './lib/log.js';
import { dryExeca } from './lib/dry-execa.js';
import dryWrite from './lib/dry-write.js';

import tmp from 'tmp-promise';

import { basename, join } from 'node:path';
import  extract from 'extract-zip';
import { finished } from 'stream/promises';
import { Readable } from 'node:stream';

tmp.setGracefulCleanup();

async function dryDownload(url, dest, dryRun) {
  if(dryRun) {
    console.log(`🌵 Downloading ${url} to ${dest}`);
    return 
  }

  automated(`Downloading ${url}`);

  var file = fs.createWriteStream(dest);
  const res = await fetch(url);
  await finished(Readable.fromWeb(res.body).pipe(file));

}

function dryExtract(path, dir, dryRun) {
  if(dryRun) {
    console.log(`🌵 Extracting ${path} into ${dir}`)
    return
  }

  automated(`Extracting ${basename(path)}`)
  return extract(path, { dir })
}

function dryCopy(from, to, dryRun) {
  if(dryRun) {
    console.log(`🌵 Copying ${from} to ${to}`);
    return
  }
  automated(`Copying ${from} to ${to}`);
  return cp(from, to, {recursive: true});
}


export default async function guides(args, options) {
  const dryRun = options.dryRun ?? false;

  await ensureOnePassword();

  const { stdout: glitchRepo } = await execa`op read ${"op://Ember Learning Team/Glitch/password"}`;
  const tmpDirectory = await tmp.dir({
    unsafeCleanup: true
  });
  
  // we need to make sure to clean up the temp directory since the remote url 
  // has the password embedded in it and it's a security risk to keep it around
  try {
    await dryExeca(`git clone ${glitchRepo}`, dryRun, {cwd: tmpDirectory.path });

    await dryDownload(`https://github.com/ember-cli/ember-new-output/archive/v${options.version}.zip`, join(tmpDirectory.path, 'version.zip'), dryRun);

    await dryExtract(join(tmpDirectory.path, 'version.zip'), tmpDirectory.path, dryRun);

    await dryCopy(join(tmpDirectory.path, `ember-new-output-${options.version}`), join(tmpDirectory.path, 'emberjs'), dryRun);

    let pkgJsonPath = join(tmpDirectory.path, 'emberjs', 'package.json');
    let pkgJson;
    
    if(dryRun) {
      pkgJson = `{ "name": "fake-content" }`;
    } else {
      pkgJson = await readFile(pkgJsonPath, 'utf-8');
      pkgJson = pkgJson.replace('ember serve', 'npx ember serve -p 4200')
    }

    await dryWrite(pkgJsonPath, pkgJson, dryRun);

    await dryExeca(`npm install`, dryRun, {
      cwd: join(tmpDirectory.path, 'emberjs')
    });


    let indexHtmlPath = join(tmpDirectory.path, 'emberjs', 'app', 'index.html');
    let indexHtml;

    if(dryRun) {
      indexHtml = `<body> fake content </body>`;
    } else {
      indexHtml = await readFile(indexHtmlPath, "utf-8");
      indexHtml = indexHtml.replace(`  </body>`, `
    <!-- include the Glitch button to show what the webpage is about and
    to make it easier for folks to view source and remix -->
    <div class="glitchButton" style="position:fixed;top:20px;right:20px;"></div>
    <script src="https://button.glitch.me/button.js"></script>
  </body>`)
    }

    await dryWrite(indexHtmlPath, indexHtml, dryRun);

    await dryExeca(`git add .`, dryRun, {cwd: join(tmpDirectory.path, 'emberjs')})
    await dryExeca(`git commit -m ${options.version}`, dryRun, {cwd: join(tmpDirectory.path, 'emberjs')})
    await dryExeca(`git push`, dryRun, {cwd: join(tmpDirectory.path, 'emberjs')})
  } finally {
    await tmpDirectory.cleanup();
  }

  console.log('success');
}
