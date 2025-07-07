# 🧠 LLM Provider Setup Guide

NiskaChat now supports **Claude Haiku** with secure API key management and proper configuration. This guide shows you how to configure the Claude Haiku provider.

## 🏗️ **Provider Architecture**

### **Supported Providers**

- **Claude Haiku** (Anthropic) - Cloud-based, fast, cost-effective

### **Key Features**

- ✅ **Secure API keys** - Environment variables, never exposed to client
- ✅ **Provider selection** - Configure preferred provider
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
```

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

## ⚙️ **Provider Configuration**

### **Provider Priority**

Set which provider to use:

```bash
# Use Claude Haiku
LLM_PROVIDER=claude-haiku
```

### **How Provider Selection Works**

1. **Primary**: Try the `LLM_PROVIDER` first
2. **Graceful Degradation**: If no providers work, show fallback messages

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
  "providers": {
    "claude-haiku": {
      "available": true,
      "provider": "claude-haiku",
      "model": "claude-3-haiku-20240307",
      "configured": true,
      "hasApiKey": true
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

### **General Issues**

**❌ "No LLM providers are available"**

- Check provider status: `curl http://localhost:3000/llm/status`
- Verify at least one provider is configured
- Check server logs for detailed error messages

## 📊 **Provider Comparison**

| Feature         | Claude Haiku           |
| --------------- | ---------------------- |
| **Speed**       | Very Fast              |
| **Cost**        | Pay per token          |
| **Privacy**     | Data sent to Anthropic |
| **Setup**       | API key only           |
| **Quality**     | Excellent for medical  |
| **Reliability** | High (cloud)           |
| **Internet**    | Required               |

## 💡 **Best Practices**

### **Production Setup**

```bash
# Recommended production configuration
LLM_PROVIDER=claude-haiku
CLAUDE_MAX_TOKENS=800
CLAUDE_TEMPERATURE=0.2
```

### **Development Setup**

```bash
# For development and testing
LLM_PROVIDER=claude-haiku
CLAUDE_MAX_TOKENS=1000
```

### **Security Reminders**

- ✅ Never commit `.env` files to git
- ✅ Use different API keys for development and production
- ✅ Regularly rotate API keys
- ✅ Monitor API usage and costs
- ✅ Use environment-specific configurations

## 🎉 **You're Ready!**

With Claude Haiku configured, NiskaChat will:

- Use Claude Haiku for fast, high-quality responses
- Provide secure, HIPAA-appropriate clinical AI assistance
- Maintain high availability with cloud-based reliability

Your API keys are secure, your setup is robust, and you have access to excellent medical AI assistance!
