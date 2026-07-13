#!/bin/bash
set -e
echo "Pulling latest changes..."
git pull
echo "Rebuilding and restarting containers..."
docker compose up -d --build
echo "Deploy complete."