import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import readReleaseArtifact from '../scripts/release-reader.mjs';

test('release reads a stable regular file and rejects links, directories, and oversized files', {
  skip: process.platform !== 'linux',
}, () => {
  const directory = fs.mkdtempSync(path.join(tmpdir(), 'neon-release-read-'));
  try {
    const artifact = path.join(directory, 'artifact.zip');
    fs.writeFileSync(artifact, 'known bytes');
    assert.equal(readReleaseArtifact(artifact).toString(), 'known bytes');
    const originalRead = fs.readSync;
    let mutated = false;
    try {
      fs.readSync = (...args) => {
        const count = originalRead(...args);
        if (!mutated && count > 0) {
          mutated = true;
          fs.writeFileSync(artifact, 'badly bytes');
          fs.utimesSync(artifact, new Date(0), new Date(0));
        }
        return count;
      };
      assert.throws(() => readReleaseArtifact(artifact), /changed while being read/);
    } finally {
      fs.readSync = originalRead;
    }
    assert.equal(mutated, true);
    const link = path.join(directory, 'link.zip');
    fs.symlinkSync(artifact, link);
    assert.throws(() => readReleaseArtifact(link), { code: 'ELOOP' });
    assert.throws(() => readReleaseArtifact(directory), /regular file/);
    fs.truncateSync(artifact, 512 * 1024 * 1024 + 1);
    assert.throws(() => readReleaseArtifact(artifact), /size limit/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
