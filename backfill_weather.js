const fs = require('fs');

const DATA_FILE = 'plants.json';

// San Francisco Coordinates
const LAT = 37.7749;
const LON = -122.4194;

// Date Range (Assuming Day 46 = Dec 6, 2025)
// Day 1 = Dec 6 - 45 days = Oct 22
const END_DATE = '2025-12-06';
const START_DATE = '2025-10-21'; // Approx 46 days.

// Read plant data
if (!fs.existsSync(DATA_FILE)) {
    console.error('No plants.json found!');
    process.exit(1);
}
const plant = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

async function fetchOpenMeteo() {
    console.log(`Fetching Open-Meteo Archive data for SF (${START_DATE} to ${END_DATE})...`);
    
    // We need: Max Temp, Min Temp, Sunrise, Sunset, Daylight Duration
    // Note: Daylight duration is in seconds in Open-Meteo.
    // Humidity is tricky in daily, taking hourly and averaging.
    
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LON}&start_date=${START_DATE}&end_date=${END_DATE}&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,daylight_duration&hourly=relative_humidity_2m&timezone=America%2FLos_Angeles`;
    
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`API Status: ${res.statusText}`);
        const data = await res.json();
        return data;
    } catch (e) {
        console.error("Open-Meteo Error:", e);
        return null;
    }
}

async function run() {
    const weatherData = await fetchOpenMeteo();
    if (!weatherData || !weatherData.daily) {
        console.error("Failed to fetch weather data.");
        return;
    }

    const daily = weatherData.daily;
    const hourly = weatherData.hourly;
    
    // Iterate 46 days
    // daily.time is array of dates
    
    for (let i = 0; i < daily.time.length; i++) {
        const dateStr = daily.time[i]; // YYYY-MM-DD
        const high = daily.temperature_2m_max[i];
        const low = daily.temperature_2m_min[i];
        const sunriseFull = daily.sunrise[i]; // ISO string 2025-10-22T07:15
        const sunsetFull = daily.sunset[i];
        const daylightSec = daily.daylight_duration[i];
        
        // Format Times (HH:MM AM/PM)
        const formatTime = (isoStr) => {
            if (!isoStr) return '?';
            const d = new Date(isoStr);
            return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        };
        
        const sunrise = formatTime(sunriseFull);
        const sunset = formatTime(sunsetFull);
        
        // Format Daylight
        const hours = Math.floor(daylightSec / 3600);
        const minutes = Math.floor((daylightSec % 3600) / 60);
        const daylightStr = `${hours} hours ${minutes} minutes`;
        
        // Calculate Avg Humidity for this day (24 hours)
        // hourly.time matches start at 00:00. Index start = i * 24
        let sumHum = 0;
        let countHum = 0;
        const startH = i * 24;
        for (let h = 0; h < 24; h++) {
            if (hourly.relative_humidity_2m[startH + h] !== undefined) {
                sumHum += hourly.relative_humidity_2m[startH + h];
                countHum++;
            }
        }
        const humidity = countHum > 0 ? Math.round(sumHum / countHum) : '?';
        
        // Construct string
        const weatherString = `High ${Math.round(high)}°F, Low ${Math.round(low)}°F, Humidity ${humidity}%, Sunrise ${sunrise}, Sunset ${sunset}, Daylight ${daylightStr}`;
        
        // Map to Day Number (1-46)
        // Array index 0 is Start Date (Oct 21). 
        // We assume Day 1 corresponds to index 0? Or index 1?
        // Let's assume start date -> day 1.
        const dayNum = i + 1;
        if (dayNum > 46) break; // Safety
        
        const dayKey = `day${dayNum}`;
        if (!plant.days[dayKey]) plant.days[dayKey] = {};
        
        // Update weather
        plant.days[dayKey].weather = weatherString;
        console.log(`Day ${dayNum} (${dateStr}): ${weatherString}`);
    }
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(plant, null, 2));
    console.log(`Updated plants.json with Open-Meteo data for ${daily.time.length} days.`);
}

run();
