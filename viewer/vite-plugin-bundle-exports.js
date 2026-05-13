/**
 * vite-plugin-bundle-exports
 *
 * At build time:
 * - Walks ../exports/ for session.json files
 * - Rewrites node.screenshot paths to relative URLs (exports/<session>/screenshots/<file>)
 * - Injects window.__BUNDLED_SESSIONS__ into the HTML with the full session array
 * - Copies the exports/ directory into dist/ as static assets so screenshots resolve
 *
 * The plugin is a no-op in dev mode (file picker still works locally).
 */

import fs from 'fs';
import path from 'path';

export default function bundleExports() {
  let isBuild = false;
  let base = '/';

  return {
    name: 'bundle-exports',

    configResolved(config) {
      isBuild = config.command === 'build';
      base = config.base || '/';
    },

    // Inject the session data as a <script> in the HTML
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!isBuild) return html;

        const exportsDir = path.resolve(__dirname, '../exports');
        if (!fs.existsSync(exportsDir)) return html;

        const sessions = [];

        const sessionDirs = fs.readdirSync(exportsDir).filter((name) => {
          const full = path.join(exportsDir, name);
          return fs.statSync(full).isDirectory();
        });

        for (const dirName of sessionDirs) {
          const sessionPath = path.join(exportsDir, dirName, 'session.json');
          if (!fs.existsSync(sessionPath)) continue;

          try {
            const raw = fs.readFileSync(sessionPath, 'utf-8');
            const data = JSON.parse(raw);
            if (!data.nodes || data.edges === undefined) continue;

            // Rewrite screenshot paths to absolute URLs using the Vite base
            // so they resolve correctly on GitHub Pages (/journeymap/exports/...)
            for (const node of Object.values(data.nodes)) {
              if (node.screenshot) {
                const filename = path.basename(node.screenshot);
                node.screenshot = `${base}exports/${dirName}/screenshots/${filename}`;
              }
            }

            // Tag with the folder name so the UI can show a session name
            if (!data.name) data.name = dirName;

            sessions.push(data);
          } catch (err) {
            console.warn(`[bundle-exports] Skipping ${dirName}: ${err.message}`);
          }
        }

        if (sessions.length === 0) return html;

        const script = `<script>window.__BUNDLED_SESSIONS__ = ${JSON.stringify(sessions)};</script>`;
        return html.replace('</head>', `${script}\n</head>`);
      },
    },

    // Copy exports/ into dist/ so screenshot URLs resolve
    closeBundle() {
      if (!isBuild) return;

      const exportsDir = path.resolve(__dirname, '../exports');
      const outDir = path.resolve(__dirname, '../dist/exports');

      if (!fs.existsSync(exportsDir)) return;

      copyDir(exportsDir, outDir);
      console.log('[bundle-exports] Copied exports/ to dist/exports/');
    },
  };
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
