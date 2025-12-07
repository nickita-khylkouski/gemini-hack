#!/bin/bash

BASE="http://localhost:3000"

# Function to set day and run analysis
analyze_day() {
    local day=$1
    echo ""
    echo "=== DAY $day ==="
    
    # Set the current day
    curl -s -X POST "$BASE/api/plant" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"CHILI PEPPER\",\"city\":\"San Francisco\",\"indoorLocation\":\"Living Room Window\",\"dayOfPlanting\":\"Day $day\",\"feedback\":\"\",\"image\":null}" > /dev/null
    
    echo "Set to Day $day"
    sleep 1
    
    # Run analysis endpoints
    for endpoint in leafcount color growth infections; do
        echo -n "  $endpoint: "
        result=$(curl -s -X POST "$BASE/api/plant/$endpoint")
        if echo "$result" | grep -q '"success":true'; then
            echo "OK"
        else
            error=$(echo "$result" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
            echo "FAILED - $error"
        fi
        sleep 2
    done
}

# Check server is running
echo "Checking server..."
response=$(curl -s "$BASE/api/plant" 2>/dev/null)
if [ -z "$response" ]; then
    echo "Server not running! Starting..."
    cd /Users/nickita/gem
    node server.js &
    sleep 3
fi

plant_name=$(curl -s "$BASE/api/plant" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
echo "Server running. Plant: $plant_name"

# Run analysis for days 20-25
for day in 20 21 22 23 24 25; do
    analyze_day $day
    sleep 3
done

echo ""
echo "=== COMPLETE ==="
