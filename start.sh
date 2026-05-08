#!/bin/bash
cd "$(dirname "$0")"

LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
MODE="${1:-lan}"

echo "======================================"
echo "  VIP视频破解 Pro - Web版"
echo "======================================"
echo ""

if [ "$MODE" = "internet" ]; then
    echo "  Mode: Internet (anywhere access)"
    echo ""
    echo "  Starting SSH tunnel via serveo.net..."
    echo ""
    pkill -f "serveo.net" 2>/dev/null
    ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=60 \
        -R 80:localhost:8000 serveo.net 2>&1 | while IFS= read -r line; do
        echo "  $line"
        if echo "$line" | grep -q "Forwarding HTTP traffic from"; then
            URL=$(echo "$line" | grep -o 'https://[^ ]*')
            echo ""
            echo "  =================================="
            echo "  Public URL (open on phone):"
            echo "  $URL"
            echo "  =================================="
            echo ""
        fi
    done &
    python3 -m http.server 8000 --directory site
else
    echo "  Mode: LAN (same WiFi only)"
    echo ""
    echo "  Open this URL on your phone:"
    echo "  http://${LOCAL_IP}:8000"
    echo ""
    echo "  Or open locally:"
    echo "  http://localhost:8000"
    echo ""
    echo "  For anywhere access, use:"
    echo "    bash start.sh internet"
    echo ""
    echo "  Press Ctrl+C to stop"
    echo "======================================"
    echo ""
    python3 -m http.server 8000 --directory site
fi
