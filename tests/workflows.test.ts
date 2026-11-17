import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * Supply-chain guard (#57, docs/CONFIGURATION.md#github-actions-pinning): every third-party
 * action in .github/workflows is pinned to a full commit SHA with the release it points to, so a
 * moved or hijacked tag cannot change what runs. Local reusable workflows (`./…`) need no pin.
 */

const DIR = '.github/workflows';
const files = readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f));

const uses = files.flatMap((file) =>
  readFileSync(`${DIR}/${file}`, 'utf8')
    .split('\n')
    .flatMap((line, i) => {
      const m = /^\s*(?:-\s+)?uses:\s*(.+)$/.exec(line);
      return m ? [{ where: `${file}:${String(i + 1)}`, ref: (m[1] ?? '').trim() }] : [];
    }),
);

describe('GitHub Actions are pinned to commit SHAs', () => {
  it('finds the workflows and their actions', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(uses.filter((u) => !u.ref.startsWith('./')).length).toBeGreaterThan(0);
  });

  it.each(uses.filter((u) => !u.ref.startsWith('./')).map((u) => [u.where, u.ref]))(
    '%s',
    (_where, ref) => {
      expect(ref).toMatch(/^[\w.-]+\/[\w./-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/);
    },
  );
});
