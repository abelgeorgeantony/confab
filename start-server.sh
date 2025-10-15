#!/bin/bash

# Get the local IP address
IP_ADDRESS=$(hostname -I | awk '{print $1}')

# Check if IP address is retrieved
if [ -z "$IP_ADDRESS" ]; then
    echo "Could not get local IP address. Exiting."
    exit 1
fi

echo "Using IP address: $IP_ADDRESS"

# Update the Caddyfile
sed -i "s/https:\/\/[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}\.[0-9]\{1,3\}/https:\/\/$IP_ADDRESS/" Caddyfile

echo "Updated Caddyfile with the new IP address."

# --- Prerequisite Checks ---

# Check for backend dependencies
if [ ! -d "backend/vendor" ]; then
    echo "Error: Composer dependencies not installed in the backend."
    echo "Please run 'composer install' in the 'backend' directory."
    exit 1
fi

# Check for backend .env file
if [ ! -f "backend/.env" ]; then
    echo "Error: .env file not found in the backend."
    echo "Please create it inside backend/ and configure it."
    exit 1
fi

# Create uploads directory and subdirectories
echo "Ensuring upload directories exist..."
mkdir -p uploads/{voice,image,profile_picture,audio,document}

# --- End Prerequisite Checks ---

# Check if ports 80 or 443 are in use
echo "Checking for processes on ports 80 and 443..."
if sudo lsof -t -i:80 >/dev/null; then
    echo "Error: Ports 80 or 443 are already in use. Please free up these ports and try again."
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Start the servers and store their PIDs
echo "Starting Caddy server..."
sudo caddy run --config ./Caddyfile > logs/caddy.log 2>&1 &
CADDY_PID=$!
echo "$CADDY_PID # Caddy Server" > logs/process-pid.log

echo "Starting PHP server..."
php -S localhost:8000 -t ./ front_controller.php > logs/php_server.log 2>&1 &
PHP_PID=$!
echo "$PHP_PID # PHP Server" >> logs/process-pid.log

echo "Starting WebSocket server..."
php ./backend/chat_server.php > logs/websocket.log 2>&1 &
WEBSOCKET_PID=$!
echo "$WEBSOCKET_PID # WebSocket Server" >> logs/process-pid.log

echo "All servers started."
echo ""
echo "Logs are available at:"
echo "  - Caddy:      logs/caddy.log"
echo "  - PHP Server: logs/php_server.log"
echo "  - WebSocket:  logs/websocket.log"
echo ""
echo "You can now access the application at https://$IP_ADDRESS"
