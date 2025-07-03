#!/usr/bin/env node

import { clearPromptCache, loadPrompt } from './promptLoader.js';

const prompts = ['clinical-chat', 'clinical-summary'];

console.log('🔄 Reloading all prompts...\n');

// Clear the cache first
clearPromptCache();

// Reload each prompt
prompts.forEach(promptName => {
  try {
    const content = loadPrompt(promptName);
    console.log(`✅ ${promptName}.txt loaded (${content.length} characters)`);
  } catch (error) {
    console.error(`❌ Failed to load ${promptName}.txt:`, error.message);
  }
});

console.log('\n🎉 Prompt reload complete!');
console.log('\nℹ️  Changes will take effect on the next API request.');
console.log('💡 Edit prompts in backend/prompts/ directory');