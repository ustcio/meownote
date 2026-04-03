import fs from 'fs';
import path from 'path';

const kitDir = 'src/pages/kit';
const files = fs.readdirSync(kitDir).filter(f => f.endsWith('.astro'));

let updated = 0;
let skipped = 0;

files.forEach(file => {
  const filePath = path.join(kitDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Check if it's a stub page (has "工具开发中，敬请期待")
  const isStub = content.includes('工具开发中，敬请期待');
  
  // Check if it already has hao-design.css import
  if (content.includes('hao-design.css')) {
    skipped++;
    return;
  }

  // For stub pages, just add the import and replace the style block
  if (isStub) {
    // Add import to frontmatter
    content = content.replace(
      /import Layout from '@layouts\/Layout\.astro';/,
      `import Layout from '@layouts/Layout.astro';
import '@styles/hao-design.css';`
    );
    
    // Replace the entire style block with minimal styles
    const styleMatch = content.match(/<style>[\s\S]*?<\/style>/);
    if (styleMatch) {
      content = content.replace(styleMatch[0], `<style>
  /* Inherits from hao-design.css */
</style>`);
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    updated++;
    console.log(`Updated (stub): ${file}`);
    return;
  }

  // For functional pages, add import and replace style block
  const hasStyle = content.includes('<style>');
  if (hasStyle) {
    // Add import to frontmatter
    if (content.includes("import Layout from '@layouts/Layout.astro'")) {
      content = content.replace(
        /import Layout from '@layouts\/Layout\.astro';/,
        `import Layout from '@layouts/Layout.astro';
import '@styles/hao-design.css';`
      );
    }
    
    // Replace the entire style block
    const styleMatch = content.match(/<style>[\s\S]*?<\/style>/);
    if (styleMatch) {
      content = content.replace(styleMatch[0], `<style>
  /* Inherits from hao-design.css */
</style>`);
    }
    
    fs.writeFileSync(filePath, content, 'utf8');
    updated++;
    console.log(`Updated: ${file}`);
  } else {
    skipped++;
  }
});

console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}`);
