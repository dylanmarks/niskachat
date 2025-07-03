# LLM Setup for MacBook Air 2020

This guide provides safe setup instructions for running LLM functionality on resource-constrained MacBook Air systems to prevent crashes and overheating.

## 🖥️ MacBook Air Considerations

MacBook Air 2020 and earlier models have limited resources:

- **RAM**: 8GB typical, shared with GPU
- **CPU**: Dual-core with thermal throttling
- **Storage**: SSD with limited space for large models
- **Cooling**: Passive cooling, prone to overheating

## 🛡️ Safe Configuration

### Backend Configuration

The backend automatically uses enhanced fallback summaries when LLM is disabled:

```bash
# Disable LLM for MacBook Air (recommended)
export LLM_ENABLED=false

# Or configure lightweight LLM settings
export LLM_ENABLED=true
export LLM_TIMEOUT=15000
export LLM_MAX_TOKENS=300
export LLM_TEMPERATURE=0.3
```

### Starting NiskaChat Safely

Use the MacBook Air optimized startup script:

```bash
./start-macbook-air.sh
```

This script:

- ✅ Disables LLM to prevent crashes
- ✅ Uses enhanced fallback summaries
- ✅ Optimizes resource usage
- ✅ Starts both backend and frontend
- ✅ Provides clean shutdown on Ctrl+C

## 🤖 Optional LLM Setup

If you want to try LLM functionality (use with caution):

### 1. Install Dependencies

```bash
# Already installed via homebrew
brew install llama.cpp
```

### 2. Use Lightweight Model

The system is configured for TinyLlama (safe for MacBook Air):

```bash
# Test CLI usage (downloads model automatically)
./run-llm.sh "Summarize this patient data briefly"
```

### 3. Start LLM Server (Lightweight)

```bash
# Start TinyLlama server with safe settings
llama-server \
  --hf-repo TheBloke/TinyLlama-1.1B-Chat-GGUF:tinyllama-1.1b-chat.q4_0.gguf \
  --host 127.0.0.1 \
  --port 8081 \
  --threads 2 \
  --ctx-size 512 \
  --batch-size 1 \
  --no-webui
```

## 🎯 Enhanced Fallback Summary

When LLM is disabled, the system provides comprehensive clinical summaries:

### Features

- **Patient Demographics**: Name, age calculation, gender, MRN
- **Active Conditions**: With codes, onset dates, verification status
- **Observations**: Clinical values with interpretation (BP ranges, etc.)
- **Medications**: Dosage, frequency, prescriber information
- **Clinical Notes**: Summary statistics and recommendations

### Example Output

```markdown
**Clinical Summary**

**Patient**: John Doe
**Age**: 48 years
**Gender**: male
**MRN**: 123456789

**Active Conditions** (2):

1. **Hypertension**
   - Code: 38341003 (SNOMED)
   - Onset: 2023-01-15
   - Status: confirmed

**Recent Observations** (3):

1. **Systolic blood pressure**: 140 mmHg (High)
   - Date: 2023-12-01
   - Code: 8480-6 (LOINC)

**Current Medications** (1):

1. **Lisinopril 10mg**
   - Dosage: Take 1 tablet daily
   - Prescriber: Dr. Smith

**Clinical Notes**:
• Patient has 2 active conditions
• 3 observations recorded
• Currently on 1 active medication
```

## 🚨 Warning Signs

Stop LLM usage immediately if you experience:

- System freezing or becoming unresponsive
- Fan running constantly at high speed
- Excessive heat from laptop
- Battery draining rapidly
- Applications closing unexpectedly

## 📊 Performance Monitoring

Monitor system resources:

```bash
# Check CPU usage
top -l 1 | grep "CPU usage"

# Check memory usage
vm_stat | head -5

# Check temperature (if available)
sudo powermetrics --samplers smc_temp -n 1
```

## 🔄 Fallback Mode (Recommended)

For production use on MacBook Air, we recommend:

1. **Always use fallback mode**: `LLM_ENABLED=false`
2. **Use the enhanced summaries**: Comprehensive clinical formatting
3. **Test LLM sparingly**: Only for development/testing
4. **Monitor system health**: Watch for overheating

## 🛠️ Troubleshooting

### LLM Server Won't Start

```bash
# Check if port is in use
lsof -i :8081

# Kill existing processes
pkill -f llama-server
```

### Model Download Fails

```bash
# Check internet connection
curl -I https://huggingface.co

# Clear cache if needed
rm -rf ~/.cache/huggingface
```

### System Overheating

```bash
# Stop all LLM processes immediately
pkill -f llama
./start-macbook-air.sh # Restart in safe mode
```

## 📚 Resources

- [llama.cpp Documentation](https://github.com/ggerganov/llama.cpp)
- [TinyLlama Model](https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-GGUF)
- [MacBook Air Thermal Management](https://support.apple.com/guide/macbook-air/keep-your-mac-notebook-within-acceptable-operating-temperatures-apd29ba6728f/mac)

---

**⚠️ Important**: MacBook Air 2020 is not designed for sustained AI workloads. The enhanced fallback summaries provide excellent clinical value without the risks associated with local LLM execution.
