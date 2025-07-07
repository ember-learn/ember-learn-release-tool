import {execa } from 'execa';
import { fatalError } from './log.js';

function signIn() {
  return execa`op signin --account ember-cli.1password.com`
}

export default async function ensureOnePassword() {
  try {
    await execa`op whoami`;
  } catch (err) {
    try {
      if (err.message.includes('account is not signed in')) {
        return signIn();
      } else if (err.message.includes('ENOENT')) {
        await execa({stdio: 'inherit'})`brew install --cask 1password/tap/1password-cli`
        return signIn();
      } else {
        fatalError(`error checking one-password commandline: ${err.message}`)
      }
    } catch (err) {
      fatalError(`unknown error occored while checking one-password commandline: ${err.message}`);
    }
  }
}