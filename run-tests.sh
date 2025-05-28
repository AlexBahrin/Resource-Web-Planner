#!/bin/bash

# This script logs in and runs the import/export tests

# Default credentials (can be overridden by command line args)
USERNAME=${1:-"aa"}
PASSWORD=${2:-"aa"}

echo "===== Testing Import/Export Functionality ====="
echo "1. Logging in as $USERNAME..."

# Get the session ID by running login.js
SESSION_ID=$(node login.js "$USERNAME" "$PASSWORD" | grep -A 1 "===== SESSION ID =====" | grep -v "=====")

# Check if we got a session ID
if [ -z "$SESSION_ID" ]; then
  echo "Failed to get session ID. Please check your credentials."
  exit 1
fi

echo "2. Login successful! Session ID: $SESSION_ID"
echo "3. Running import/export tests..."

# Run the test script with our session ID
node test-import-export.js "$SESSION_ID"

echo "===== Test script execution completed ====="
