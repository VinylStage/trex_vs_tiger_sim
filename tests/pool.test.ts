import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { trustedWorkerUrl, WORKER_POLICY } from '../src/ui/pool';

/** A stand-in for `window.trustedTypes` that records the policies created. */
function fakeTrustedTypes() {
  const names: string[] = [];
  return {
    names,
    createPolicy(name: string, rules: { createScriptURL(input: string): string }) {
      names.push(name);
      return { createScriptURL: (input: string) => ({ trusted: rules.createScriptURL(input) }) };
    },
  };
}

describe('trustedWorkerUrl (Trusted Types, #59)', () => {
  it('returns the plain URL where Trusted Types are unsupported', () => {
    expect(trustedWorkerUrl('/assets/sim.worker-x.js', undefined)).toBe('/assets/sim.worker-x.js');
  });

  it('wraps the worker URL through the one policy the CSP allows', () => {
    const tt = fakeTrustedTypes();
    const out = trustedWorkerUrl('/assets/sim.worker-x.js', tt) as unknown;
    expect(out).toEqual({ trusted: '/assets/sim.worker-x.js' });
    expect(tt.names).toEqual([WORKER_POLICY]);
  });

  it('names the policy that public/_headers allows', () => {
    const csp = /Content-Security-Policy: (.*)/.exec(readFileSync('public/_headers', 'utf8'))?.[1];
    expect(csp).toContain("require-trusted-types-for 'script'");
    expect(csp).toContain(`trusted-types ${WORKER_POLICY}`);
  });

  it('rejects any other URL', () => {
    let rules: { createScriptURL(input: string): string } | undefined;
    trustedWorkerUrl('/assets/sim.worker-x.js', {
      createPolicy(_name, r) {
        rules = r;
        return { createScriptURL: (input: string) => r.createScriptURL(input) };
      },
    });
    expect(() => rules?.createScriptURL('https://evil.example/x.js')).toThrow(TypeError);
  });
});
