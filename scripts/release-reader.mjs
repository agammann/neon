import fs from 'node:fs';

const MAX_ARTIFACT_BYTES = 512 * 1024 * 1024;

export default function readReleaseArtifact(location) {
  // Publishing runs on Linux, where O_NOFOLLOW keeps the opened path from
  // resolving through a substituted symlink.
  if (process.platform !== 'linux' || !Number.isInteger(fs.constants.O_NOFOLLOW)) {
    throw new Error('Release artifact reads require Linux O_NOFOLLOW.');
  }
  const handle = fs.openSync(location, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const before = fs.fstatSync(handle, { bigint: true });
    if (!before.isFile()) throw new Error('Artifact is not a regular file.');
    if (before.size < 0n || before.size > BigInt(MAX_ARTIFACT_BYTES)) {
      throw new Error('Artifact exceeds the release size limit.');
    }
    const data = Buffer.allocUnsafe(Number(before.size));
    let offset = 0;
    while (offset < data.length) {
      const count = fs.readSync(handle, data, offset, data.length - offset, null);
      if (count === 0) throw new Error('Artifact changed while being read.');
      offset += count;
    }
    if (fs.readSync(handle, Buffer.alloc(1), 0, 1, null) !== 0) {
      throw new Error('Artifact changed while being read.');
    }
    const after = fs.fstatSync(handle, { bigint: true });
    if (after.dev !== before.dev || after.ino !== before.ino ||
        after.size !== before.size || after.mtimeNs !== before.mtimeNs ||
        after.ctimeNs !== before.ctimeNs) {
      throw new Error('Artifact changed while being read.');
    }
    return data;
  } finally {
    fs.closeSync(handle);
  }
}
