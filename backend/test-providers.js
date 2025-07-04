#!/usr/bin/env node

/**
 * Test script for LLM providers
 * Run with: node backend/test-providers.js
 */

import { getLLMProviderFactory } from './providers/providerFactory.js';

async function testProviders() {
  console.log('🧪 Testing LLM Providers...\n');

  const factory = getLLMProviderFactory();

  // Test provider status
  console.log('📊 Provider Status:');
  try {
    const status = await factory.getProvidersStatus();
    console.log(JSON.stringify(status, null, 2));
  } catch (error) {
    console.error('❌ Failed to get provider status:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test individual providers
  const providers = factory.getAllProviders();
  
  for (const [name, provider] of providers) {
    console.log(`🔍 Testing ${name}...`);
    
    try {
      // Check if configured
      const configured = provider.isConfigured();
      console.log(`   Configured: ${configured ? '✅' : '❌'}`);
      
      if (!configured) {
        const requiredVars = provider.getRequiredEnvVars();
        if (requiredVars.length > 0) {
          console.log(`   Missing env vars: ${requiredVars.join(', ')}`);
        }
      }
      
      // Check availability
      const available = await provider.isAvailable();
      console.log(`   Available: ${available ? '✅' : '❌'}`);
      
      // If available, test a simple request
      if (available && configured) {
        console.log(`   Testing simple request...`);
        try {
          const response = await provider.generateResponse(
            'Say hello in exactly 3 words.',
            { maxTokens: 10 }
          );
          console.log(`   Response: "${response}"`);
          console.log(`   ${name}: ✅ Working`);
        } catch (error) {
          console.log(`   ${name}: ❌ Error - ${error.message}`);
        }
      } else {
        console.log(`   ${name}: ⏸️  Skipped (not available or configured)`);
      }
      
    } catch (error) {
      console.log(`   ${name}: ❌ Error - ${error.message}`);
    }
    
    console.log('');
  }

  console.log('='.repeat(50) + '\n');

  // Test the factory's best provider selection
  console.log('🎯 Testing Best Provider Selection:');
  try {
    const hasProvider = await factory.hasAvailableProvider();
    console.log(`Has available provider: ${hasProvider ? '✅' : '❌'}`);
    
    if (hasProvider) {
      const result = await factory.generateResponse(
        'Respond with exactly the word "SUCCESS" and nothing else.',
        { maxTokens: 5 }
      );
      console.log(`Best provider: ${result.provider}`);
      console.log(`Response: "${result.response}"`);
      console.log('✅ Factory test successful');
    } else {
      console.log('❌ No providers available for testing');
    }
  } catch (error) {
    console.log(`❌ Factory test failed: ${error.message}`);
  }

  console.log('\n🎉 Provider testing complete!');
}

// Run the test
testProviders().catch(error => {
  console.error('💥 Test script failed:', error);
  process.exit(1);
});