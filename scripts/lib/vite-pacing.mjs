// `import pacing from 'virtual:pacing'`: config/pacing.yaml as the site ships it, checked by
// scripts/lib/pacing.mjs. A broken file fails the build and the dev server names every error.
import { loadPacing } from './pacing.mjs';

const ID = 'virtual:pacing';
const RESOLVED = `\0${ID}`;

export function pacing() {
  let root = process.cwd();
  return {
    name: 'algoglyph-pacing',
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      return id === ID ? RESOLVED : null;
    },
    load(id) {
      if (id !== RESOLVED) return null;
      const { errors, model, file } = loadPacing(root);
      this.addWatchFile(file);
      if (errors.length) this.error(`pacing: ${errors.length} error(s)\n  ${errors.join('\n  ')}`);
      return `export default ${JSON.stringify(model)};`;
    },
  };
}
