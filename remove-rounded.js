const fs = require('fs');
const path = require('path');

const directories = [
  path.join(__dirname, 'app'),
  path.join(__dirname, 'components/landing')
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      // Match any rounded- utility class
      const newContent = content.replace(/\brounded-[a-zA-Z0-9\[\]-]+\b/g, '');
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

directories.forEach(processDirectory);
