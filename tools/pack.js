'use strict';
// Đóng gói extension thành file .zip để cài trên máy khác (Load unpacked).
// Chạy: npm run pack   ->  dist/VNPost-ChuyenTiep-v<version>.zip
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'extension');
const manifest = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'));
const name = 'VNPost-ChuyenTiep-v' + manifest.version;
const dist = path.join(root, 'dist');
const out = path.join(dist, name);
const outExt = path.join(out, 'extension');

fs.rmSync(out, { recursive: true, force: true });
fs.rmSync(out + '.zip', { force: true });
fs.mkdirSync(out, { recursive: true });

// 1. Chép extension, bỏ phần chỉ dùng khi phát triển.
fs.cpSync(src, outExt, {
  recursive: true,
  filter: (p) => !/[\\/]sidepanel[\\/]dev([\\/]|$)/.test(p)
});
const indexPath = path.join(outExt, 'sidepanel', 'index.html');
const html = fs.readFileSync(indexPath, 'utf8')
  .split('\n').filter((l) => l.indexOf('dev/fake-executor.js') === -1).join('\n');
fs.writeFileSync(indexPath, html);

// 2. Kiểm tra mọi tệp được tham chiếu đều có mặt trong gói.
const missing = [];
const need = (rel, base) => {
  const p = path.join(base || outExt, rel);
  if (!fs.existsSync(p)) missing.push(path.relative(outExt, p));
};
need(manifest.background.service_worker);
need(manifest.side_panel.default_path);
Object.values(manifest.icons || {}).forEach((f) => need(f));
manifest.content_scripts.forEach((c) => c.js.forEach((f) => need(f)));
const sidepanelDir = path.join(outExt, 'sidepanel');
for (const m of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (/^(https?:|data:)/.test(m[1])) continue;
  need(m[1], sidepanelDir);
}
if (missing.length) {
  console.error('THIẾU TỆP trong gói:\n  ' + missing.join('\n  '));
  process.exit(1);
}

// 3. Hướng dẫn (UTF-8 có BOM để Notepad hiển thị đúng tiếng Việt) và file Excel mẫu.
const guide = fs.readFileSync(path.join(root, 'docs', 'HUONG-DAN-CAI-DAT-VA-SU-DUNG.md'), 'utf8').replace(/\r?\n/g, '\r\n');
fs.writeFileSync(path.join(out, 'HUONG-DAN.txt'), '\uFEFF' + guide);
fs.copyFileSync(path.join(src, 'assets', 'mau-import-chuyen-tiep.xlsx'), path.join(out, 'mau-import-chuyen-tiep.xlsx'));

// 4. Nén bằng tar của Windows 10 (ra zip dùng dấu / chuẩn, mở được ở mọi nơi).
const r = cp.spawnSync('tar', ['-a', '-c', '-f', name + '.zip', name], { cwd: dist, stdio: 'inherit' });
if (r.status !== 0) { console.error('Nén thất bại'); process.exit(1); }

const size = (fs.statSync(out + '.zip').size / 1024).toFixed(0);
console.log('Đã đóng gói: ' + path.relative(root, out) + '.zip (' + size + ' KB), phiên bản ' + manifest.version);
