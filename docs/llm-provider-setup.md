# 🧠 LLM Provider Setup Guide

NiskaChat now supports **multiple LLM providers** with automatic fallback and proper API key security. This guide shows you how to configure Claude Haiku and local llama providers.

## 🏗️ **Provider Architecture**

### **Supported Providers**

- **Claude Haiku** (Anthropic) - Cloud-based, fast, cost-effective
- **Local Llama** (llama.cpp) - Local inference, privacy-focused

### **Key Features**

- ✅ **Automatic fallback** - If preferred provider fails, falls back to secondary
- ✅ **Secure API keys** - Environment variables, never exposed to client
- ✅ **Provider selection** - Configure preferred and fallback providers
- ✅ **Status monitoring** - Real-time provider availability checks
- ✅ **Consistent interface** - Same API for all providers

## 🔐 **Security Setup**

### **1. Create Environment File**

```bash
# Copy the example file
cp .env.example .env

# Edit with your actual values
vim .env
```

### **2. Configure API Keys**

The `.env` file is **gitignored** and never committed to version control.

```bash
# Required for Claude Haiku
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here

# Provider configuration
LLM_PROVIDER=claude-haiku
# Optional: fallback provider if the primary fails
# Leave unset to disable fallback
# LLM_FALLBACK_PROVIDER=local-llama
```

If you leave `LLM_FALLBACK_PROVIDER` unset, the application won't attempt
a fallback provider.

## 🎯 **Claude Haiku Setup**

### **1. Get Anthropic API Key**

1. Visit: https://console.anthropic.com/
2. Create an account or sign in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-ant-api03-`)

### **2. Add to Environment**

```bash
# In your .env file
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here
LLM_PROVIDER=claude-haiku
```

### **3. Optional Configuration**

```bash
# Customize Claude behavior
CLAUDE_MODEL=claude-3-haiku-20240307
CLAUDE_MAX_TOKENS=1000
CLAUDE_TEMPERATURE=0.3
CLAUDE_TIMEOUT=30000
```

### **4. Test Claude Setup**

```bash
# Start the backend
npm run start:backend

# Check provider status
curl http://localhost:3000/llm/status
```

## 🏠 **Local Llama Setup**

### **1. Install llama.cpp** (if not already done)

```bash
# macOS with Homebrew
brew install llama.cpp

# Or follow existing setup from Phase 10
```

### **2. Start Local Server**

```bash
# Start llama.cpp server (example)
llama-server --model path/to/your/model.gguf --port 8081
```

### **3. Configure Environment**

```bash
# In your .env file
LLAMA_URL=http://127.0.0.1:8081
# LLM_FALLBACK_PROVIDER=local-llama  # optional; unset to disable fallback
```

### **4. Optional Configuration**

```bash
# Customize local llama behavior
LLAMA_MODEL=biomistral
LLAMA_MAX_TOKENS=300
LLAMA_TEMPERATURE=0.3
LLAMA_TIMEOUT=15000
```

## ⚙️ **Provider Configuration**

### **Provider Priority**

Set which provider to use first and which to fall back to:

```bash
# Use Claude first, local llama as backup
LLM_PROVIDER=claude-haiku
LLM_FALLBACK_PROVIDER=local-llama

# Use local llama first, Claude as backup
LLM_PROVIDER=local-llama
LLM_FALLBACK_PROVIDER=claude-haiku
```

### **How Provider Selection Works**

1. **Primary**: Try the `LLM_PROVIDER` first
2. **Fallback**: If primary fails, try `LLM_FALLBACK_PROVIDER`
3. **Any Available**: If both fail, try any other configured provider
4. **Graceful Degradation**: If no providers work, show fallback messages

## 🧪 **Testing Your Setup**

### **1. Check Provider Status**

```bash
curl http://localhost:3000/llm/status
```

**Expected Response:**

```json
{
  "llmAvailable": true,
  "preferredProvider": "claude-haiku",
  "fallbackProvider": null,
  "providers": {
    "claude-haiku": {
      "available": true,
      "provider": "claude-haiku",
      "model": "claude-3-haiku-20240307",
      "configured": true,
      "hasApiKey": true
    },
    "local-llama": {
      "available": true,
      "provider": "local-llama",
      "url": "http://127.0.0.1:8081",
      "model": "biomistral"
    }
  }
}
```

### **2. Test Chat Interface**

```bash
# Start the full app
npm run start:dev

# Use the chat interface in the browser
# Try asking: "What can you tell me about this patient?"
```

### **3. Test API Directly**

```bash
curl -X POST http://localhost:3000/llm \
  -H "Content-Type: application/json" \
  -d '{
    "context": "clinical_chat",
    "query": "What are the key clinical findings?",
    "patientData": {"patient": {"name": [{"given": ["Test"], "family": "Patient"}]}}
  }'
```

## 🚨 **Troubleshooting**

### **Claude Haiku Issues**

**❌ "Missing ANTHROPIC_API_KEY"**

- Check your `.env` file has the correct key
- Verify the key starts with `sk-ant-api03-`
- Restart the backend server after adding the key

**❌ "Authentication failed"**

- Verify your API key is correct
- Check you have credits in your Anthropic account
- Try generating a new API key

**❌ "Rate limit exceeded"**

- Wait a few minutes and try again
- Consider upgrading your Anthropic plan
- Configure local llama as fallback

### **Local Llama Issues**

**❌ "Local Llama unavailable"**

- Check llama.cpp server is running: `curl http://127.0.0.1:8081/v1/models`
- Verify the URL in your `.env` file
- Check if another process is using port 8081

**❌ "Model not found"**

- Ensure your model file exists
- Check the model path in llama.cpp startup
- Verify the model format is compatible

### **General Issues**

**❌ "No LLM providers are available"**

- Check provider status: `curl http://localhost:3000/llm/status`
- Verify at least one provider is configured
- Check server logs for detailed error messages

## 📊 **Provider Comparison**

| Feature         | Claude Haiku           | Local Llama             |
| --------------- | ---------------------- | ----------------------- |
| **Speed**       | Very Fast              | Fast                    |
| **Cost**        | Pay per token          | Free (after setup)      |
| **Privacy**     | Data sent to Anthropic | Completely local        |
| **Setup**       | API key only           | Model download + server |
| **Quality**     | Excellent for medical  | Good (model dependent)  |
| **Reliability** | High (cloud)           | High (local)            |
| **Internet**    | Required               | Not required            |

## 💡 **Best Practices**

### **Production Setup**

```bash
# Recommended production configuration
LLM_PROVIDER=claude-haiku
LLM_FALLBACK_PROVIDER=local-llama
CLAUDE_MAX_TOKENS=800
CLAUDE_TEMPERATURE=0.2
```

### **Development Setup**

```bash
# For development and testing
LLM_PROVIDER=local-llama
LLM_FALLBACK_PROVIDER=claude-haiku
LLAMA_MAX_TOKENS=300
```

### **Security Reminders**

- ✅ Never commit `.env` files to git
- ✅ Use different API keys for development and production
- ✅ Regularly rotate API keys
- ✅ Monitor API usage and costs
- ✅ Use environment-specific configurations

## 🎉 **You're Ready!**

With both providers configured, NiskaChat will:

- Use your preferred provider for fast responses
- Automatically fall back if the primary provider fails
- Provide secure, HIPAA-appropriate clinical AI assistance
- Maintain high availability with multiple provider options

Your API keys are secure, your setup is robust, and you have the flexibility to use either cloud or local AI providers as needed!
