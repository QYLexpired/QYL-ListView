import { compile } from 'sass';
import { build } from 'esbuild';
import { execSync } from 'child_process';
import { existsSync, rmSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const scssPath = resolve(__dirname, 'styles/index.scss');
const cssPath = resolve(__dirname, 'index.css');
const cssResult = compile(scssPath, { style: 'compressed' });
writeFileSync(cssPath, cssResult.css);
console.log('✅ SCSS compiled: index.css');
const tsEntry = resolve(__dirname, 'src/index.ts');
const jsOut = resolve(__dirname, 'index.js');
await build({
    entryPoints: [tsEntry],
    outfile: jsOut,
    bundle: true,
    format: 'cjs',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    external: ['siyuan'],
    target: 'es2020',
    minify: true,
});
console.log('✅ TypeScript built: index.js');
const pkg = JSON.parse(
    (await import('fs/promises')).readFileSync(resolve(__dirname, 'package.json'), 'utf-8')
);
const zipName = `package-${pkg.version}.zip`;
const zipPath = resolve(__dirname, zipName);
if (existsSync(zipPath)) {
    rmSync(zipPath);
}
const files = [
    'i18n',
    'icon.png',
    'preview.png',
    'index.css',
    'index.js',
    'plugin.json',
    'README.md',
    'README.zh-CN.md',
];
const fileList = files.map(f => `"${f}"`).join(' ');
execSync(`zip -r "${zipPath}" ${fileList}`, { cwd: __dirname, stdio: 'inherit' });
console.log(`✅ Package created: ${zipName}`);
