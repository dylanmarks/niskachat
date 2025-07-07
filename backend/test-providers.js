#!/usr/bin/env node

/**
 * Test script for LLM providers
 * Run with: node backend/test-providers.js
 */

import { getLLMProviderFactory } from './providers/providerFactory.js';
import logger from './utils/logger.js';

async function testProviders() {
  logger.info('🧪 Testing LLM Providers...\n');

  const factory = getLLMProviderFactory();

  // Test provider status
  logger.info('📊 Provider Status:');
  try {
    const status = await factory.getProvidersStatus();
    logger.info(JSON.stringify(status, null, 2));
  } catch (error) {
    logger.error('❌ Failed to get provider status:', error.message);
  }

  logger.info('\n' + '='.repeat(50) + '\n');

  // Test individual providers
  const providers = factory.getAllProviders();
  
  for (const [name, provider] of providers) {
    logger.info(`🔍 Testing ${name}...`);
    
    try {
      // Check if configured
      const configured = provider.isConfigured();
      logger.info(`   Configured: ${configured ? '✅' : '❌'}`);
      
      if (!configured) {
        const requiredVars = provider.getRequiredEnvVars();
        if (requiredVars.length > 0) {
          logger.info(`   Missing env vars: ${requiredVars.join(', ')}`);
        }
      }
      
      // Check availability
      const available = await provider.isAvailable();
      logger.info(`   Available: ${available ? '✅' : '❌'}`);
      
      // If available, test a simple request
      if (available && configured) {
        logger.info(`   Testing simple request...`);
        try {
          const response = await provider.generateResponse(
            'Say hello in exactly 3 words.',
            { maxTokens: 10 }
          );
          logger.info(`   Response: "${response}"`);
          logger.info(`   ${name}: ✅ Working`);
        } catch (error) {
          logger.info(`   ${name}: ❌ Error - ${error.message}`);
        }
      } else {
        logger.info(`   ${name}: ⏸️  Skipped (not available or configured)`);
      }
      
    } catch (error) {
      logger.info(`   ${name}: ❌ Error - ${error.message}`);
    }
    
    logger.info('');
  }

  logger.info('='.repeat(50) + '\n');

  // Test the factory's best provider selection
  logger.info('🎯 Testing Best Provider Selection:');
  try {
    const hasProvider = await factory.hasAvailableProvider();
    logger.info(`Has available provider: ${hasProvider ? '✅' : '❌'}`);
    
    if (hasProvider) {
      const result = await factory.generateResponse(
        'Respond with exactly the word "SUCCESS" and nothing else.',
        { maxTokens: 5 }
      );
      logger.info(`Best provider: ${result.provider}`);
      logger.info(`Response: "${result.response}"`);
      logger.info('✅ Factory test successful');
    } else {
      logger.info('❌ No providers available for testing');
    }
  } catch (error) {
    logger.info(`❌ Factory test failed: ${error.message}`);
  }

  logger.info('\n🎉 Provider testing complete!');
}

// Run the test
testProviders().catch(error => {
  logger.error('💥 Test script failed:', error);
  process.exit(1);
});