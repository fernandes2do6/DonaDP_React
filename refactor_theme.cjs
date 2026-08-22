const fs = require('fs');
const path = require('path');

const srcDirs = [
  'c:/Users/gomes/APP_Patricia/DonaDP_React/src/pages',
  'c:/Users/gomes/APP_Patricia/DonaDP_React/src/components'
];

function processDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.jsx')) {
            processFile(fullPath);
        }
    }
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // 1. Swap dark theme base classes
    content = content.replace(/bg-dark-surface/g, 'bg-light-surface');
    content = content.replace(/bg-dark-bg/g, 'bg-light-bg');
    content = content.replace(/border-dark-border/g, 'border-brand-brown/30');
    content = content.replace(/text-dark-muted/g, 'text-light-muted');
    
    // 2. Swap brand colors
    content = content.replace(/brand-purple/g, 'brand-orange');
    content = content.replace(/brand-pink/g, 'brand-yellow');
    
    // 3. Improve borders to be more Autumnal
    content = content.replace(/border-white\/10/g, 'border-brand-brown/20');
    content = content.replace(/border-white\/20/g, 'border-brand-brown/30');
    content = content.replace(/border-gray-\d+/g, 'border-brand-brown/20');
    
    // 4. Handle Text White
    // Replace semi-transparent white text
    content = content.replace(/text-white\/70/g, 'text-light-muted');
    content = content.replace(/text-white\/50/g, 'text-light-muted');
    content = content.replace(/text-white\/80/g, 'text-light-muted');
    
    // Replace general text-gray
    content = content.replace(/text-gray-\d+/g, 'text-light-muted');
    content = content.replace(/bg-gray-\d+\/\d+/g, 'bg-brand-orange/10');
    content = content.replace(/bg-gray-800/g, 'bg-light-surface');
    content = content.replace(/bg-gray-900/g, 'bg-light-bg');

    // Replace text-white everywhere first
    content = content.replace(/text-white/g, 'text-light-text');
    
    // Restore text-white where it matters (on brand orange and green buttons)
    // We can just find occurrences of `bg-brand-orange text-light-text` and fix them
    content = content.replace(/bg-brand-orange(.*?)text-light-text/g, 'bg-brand-orange$1text-white');
    content = content.replace(/text-light-text(.*?)bg-brand-orange/g, 'text-white$1bg-brand-orange');
    
    content = content.replace(/bg-brand-green(.*?)text-light-text/g, 'bg-brand-green$1text-white');
    content = content.replace(/text-light-text(.*?)bg-brand-green/g, 'text-white$1bg-brand-green');

    // Shadows
    content = content.replace(/shadow-black\/20/g, 'shadow-brand-brown/20');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
    }
}

srcDirs.forEach(processDirectory);
console.log('Refactoring complete.');
