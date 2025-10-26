#!/usr/bin/env node

console.log('Starting build process...');
console.log('Node version:', process.version);
console.log('NPM version:', process.env.npm_version);

const { execSync } = require('child_process');

try {
  console.log('Installing client dependencies...');
  execSync('npm install', { cwd: 'client', stdio: 'inherit' });
  
  console.log('Building client...');
  execSync('npm run build', { cwd: 'client', stdio: 'inherit' });
  
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}