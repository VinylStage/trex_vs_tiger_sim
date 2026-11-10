import { describe, expect, it } from 'vitest';
import { FREE_MODEL_VERSION, type FreeConfig } from '../src/sim/free/config';
import {
  defaultSimpleConfig,
  hasHiddenEdits,
  simpleCanShow,
  simpleRunConfig,
} from '../src/ui/simple-model';

/*
 * Simple runs keep the config's model version (#154 review). This build runs models 1 and 2
 * (#169, #197); a Simple page opens on the newest.
 */

describe('Simple runs and the model version', () => {
  it('keep the mv of the config they run', () => {
    expect(defaultSimpleConfig().mv).toBe(FREE_MODEL_VERSION);
    expect(simpleRunConfig(defaultSimpleConfig(), 5).mv).toBe(2);
    const v1: FreeConfig = { ...defaultSimpleConfig(), mv: 1 };
    expect(simpleRunConfig(v1, 5).mv).toBe(1);
  });

  it('so a config of another model version can still be shown in Simple', () => {
    const v1: FreeConfig = { ...simpleRunConfig(defaultSimpleConfig(), 5), mv: 1 };
    expect(hasHiddenEdits(v1)).toBe(false);
    expect(simpleCanShow(v1)).toBe(true);
  });
});
