#!/bin/bash

# TinyLlama runner for MacBook Air - safe settings to avoid crashes
# Usage: ./run-llm.sh "Your prompt here"

# Check if prompt is provided
if [ -z "$1" ]; then
  echo "Usage: $0 \"Your prompt here\""
  exit 1
fi

# Use llama-cli with TinyLlama and safe settings for MacBook Air
llama-cli \
  --hf-repo TinyLlama/TinyLlama-1.1B-Chat-v1.0 \
  --hf-file tinyllama-1.1b-chat-v1.0.q4_0.gguf \
  --threads 2 \
  --ctx-size 512 \
  --batch-size 1 \
  --temp 0.3 \
  --top-p 0.9 \
  --repeat-penalty 1.1 \
  --prompt "$1" \
  --no-escape \
  --log-disable
