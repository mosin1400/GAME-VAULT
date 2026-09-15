/** کپی آیکون‌های SVG به dist (n8n آیکون‌ها را کنار فایل node می‌خواهد) */
const fs = require("fs");
const path = require("path");
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".svg")) {
      const dest = path.join("dist", p);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(p, dest);
    }
  }
}
walk("nodes");
console.log("assets copied");
