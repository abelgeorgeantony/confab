#!/bin/bash

PID_FILE="logs/process-pid.log"

if [ ! -f "$PID_FILE" ] || ! [ -s "$PID_FILE" ]; then
    echo "PID log file not found at $PID_FILE or is empty. Are the servers running?"
    exit 1
fi

echo "Stopping servers..."

# Read each line of the PID file
while read -r line || [[ -n "$line" ]]; do
    # Extract the PID (the first field)
    PID=$(echo "$line" | awk '{print $1}')
    # Extract the comment (everything after the '# ')
    COMMENT=$(echo "$line" | awk -F'# ' '{print $2}')

    if [ -n "$PID" ]; then
        echo "Stopping $COMMENT (PID: $PID)..."
        # The Caddy process needs sudo to be killed
        if [[ "$COMMENT" == "Caddy Server" ]]; then
            sudo kill "$PID"
        else
            kill "$PID"
        fi
    fi
done < "$PID_FILE"

# Clear the PID file
> "$PID_FILE"

echo "All servers stopped."
