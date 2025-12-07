const BASE = 'http://localhost:3000';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function analyzeDay(day) {
    console.log(`\n=== Analyzing Day ${day} ===`);
    
    // First, get current plant data
    const plantRes = await fetch(`${BASE}/api/plant`);
    const plantData = await plantRes.json();
    const plant = plantData.plant;
    
    if (!plant) {
        console.log('No plant data found!');
        return;
    }
    
    // Set the current day
    await fetch(`${BASE}/api/plant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: plant.name,
            city: plant.city,
            indoorLocation: plant.indoorLocation,
            dayOfPlanting: `Day ${day}`,
            feedback: plant.days[`day${day}`]?.feedback || '',
            image: null
        })
    });
    console.log(`Set to Day ${day}`);
    
    // Check if image exists for this day
    const checkRes = await fetch(`${BASE}/api/plant`);
    const checkData = await checkRes.json();
    const dayData = checkData.plant.days[`day${day}`] || {};
    
    if (!dayData.image) {
        console.log(`No image for Day ${day} - skipping image-based analysis`);
        // Only do weather
        try {
            const weatherRes = await fetch(`${BASE}/api/plant/weather`, { method: 'POST' });
            const weatherData = await weatherRes.json();
            console.log(`Weather: ${weatherData.success ? 'OK' : 'FAILED - ' + weatherData.error}`);
        } catch(e) { 
            console.log(`Weather: ERROR - ${e.message}`); 
        }
        return;
    }
    
    // Run all analyses
    const endpoints = ['weather', 'leafcount', 'color', 'growth', 'infections'];
    
    for (const ep of endpoints) {
        try {
            console.log(`Running ${ep}...`);
            const res = await fetch(`${BASE}/api/plant/${ep}`, { method: 'POST' });
            const data = await res.json();
            if (data.error) {
                console.log(`${ep}: FAILED - ${data.error}`);
            } else {
                console.log(`${ep}: OK`);
            }
        } catch(e) {
            console.log(`${ep}: ERROR - ${e.message}`);
        }
        // Small delay between API calls
        await sleep(2000);
    }
}

async function main() {
    console.log('Starting batch analysis for days 20-25...');
    
    for (let day = 20; day <= 25; day++) {
        await analyzeDay(day);
        // Delay between days
        await sleep(3000);
    }
    
    console.log('\n=== BATCH ANALYSIS COMPLETE ===');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
