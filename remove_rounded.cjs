const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  const regexes = [
    /(?<![\w-])rounded-(sm|md|lg|xl|2xl|3xl)(?![\w-])/g,
    /(?<![\w-])rounded-\[[^\]]+\](?![\w-])/g,
    /(?<![\w-])rounded-[trblxy]+-(sm|md|lg|xl|2xl|3xl)(?![\w-])/g,
    /(?<![\w-])rounded-[trblxy]+-\[[^\]]+\](?![\w-])/g,
    /(?<![\w-])rounded-[trblxy]+(?![\w-])/g,
    /(?<![\w-])rounded(?![\w-])/g
  ];

  regexes.forEach(regex => {
    content = content.replace(regex, '');
  });

  // Clean up multiple spaces inside className
  content = content.replace(/className="([^"]*)"/g, (match, p1) => {
    return `className="${p1.replace(/\s+/g, ' ').trim()}"`;
  });
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      processFile(fullPath);
    }
  }
}

walk('./components');
