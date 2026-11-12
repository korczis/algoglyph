// `import catalogue from 'virtual:catalogue'`: the validated catalogue model, as the site
// ships it. A catalogue with any error fails the build and the dev server names every one.
import { join } from 'node:path';
import { loadCatalogue } from './catalogue.mjs';
import { graph } from './graph.mjs';

const ID = 'virtual:catalogue';
const RESOLVED = `\0${ID}`;

export function catalogue() {
  let root = process.cwd();
  return {
    name: 'algoglyph-catalogue',
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      return id === ID ? RESOLVED : null;
    },
    load(id) {
      if (id !== RESOLVED) return null;
      const { errors, model, files } = loadCatalogue(root);
      for (const f of files) this.addWatchFile(f);
      if (errors.length) {
        this.error(`catalogue: ${errors.length} error(s)\n  ${errors.join('\n  ')}`);
      }
      return `export default ${JSON.stringify(model)};`;
    },
    // the machine-readable surfaces of the same model: catalogue.json and graph.json
    generateBundle() {
      const { errors, model } = loadCatalogue(root);
      if (errors.length) this.error(`catalogue: ${errors.length} error(s)`);
      this.emitFile({ type: 'asset', fileName: 'catalogue.json', source: `${JSON.stringify(model)}\n` });
      this.emitFile({ type: 'asset', fileName: 'graph.json', source: `${JSON.stringify(graph(model))}\n` });
    },
    configureServer(server) {
      // a new or removed entry, plate or kernel changes the model: reload it
      const dirs = ['catalogue', 'src/plates', 'src/kernels'].map((d) => join(root, d));
      const touch = (file) => {
        if (!dirs.some((d) => file.startsWith(d))) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.add(dirs);
      server.watcher.on('add', touch);
      server.watcher.on('unlink', touch);
      server.watcher.on('change', (f) => { if (f.startsWith(dirs[0])) touch(f); });
    },
  };
}
