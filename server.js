require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

const DATA_FILE = 'plants.json';
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Helper to read plant data
function getPlantData() {
    if (!fs.existsSync(DATA_FILE)) {
        return null;
    }
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
}

// Helper to save plant data
function savePlantData(plant) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(plant, null, 2));
}

// Get current plant data
app.get('/api/plant', (req, res) => {
    const plant = getPlantData();
    if (!plant) {
        return res.json({ plant: null });
    }
    res.json({ plant });
});

// Save/update plant info (constants + current day data)
app.post('/api/plant', (req, res) => {
    const { name, city, indoorLocation, dayOfPlanting, feedback, image } = req.body;
    
    let plant = getPlantData();
    
    // Parse day number from "Day 14" format
    const dayNum = parseInt(dayOfPlanting.replace(/\D/g, '')) || 1;
    const dayKey = `day${dayNum}`;
    
    // If no plant exists, create new structure
    if (!plant) {
        plant = {
            name: name,
            city: city,
            indoorLocation: indoorLocation,
            about: null,
            currentDay: dayNum,
            days: {}
        };
        // Initialize days up to current day or 100, whichever is higher
        const maxDay = Math.max(dayNum, 100);
        for (let i = 1; i <= maxDay; i++) {
            plant.days[`day${i}`] = {};
        }
    } else {
        // Update constants
        plant.name = name;
        plant.city = city;
        plant.indoorLocation = indoorLocation;
        plant.currentDay = dayNum;
        
        // Ensure day entry exists (dynamically extend days if needed)
        if (!plant.days[dayKey]) {
            plant.days[dayKey] = {};
        }
    }
    
    // Handle image saving
    let imagePath = null;
    if (image && image.startsWith('data:image')) {
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        const sanitizedName = (name || 'plant').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `${sanitizedName}_day${dayNum}.png`;
        const filePath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(filePath, buffer);
        imagePath = `uploads/${filename}`;
    }
    
    // Update current day data
    if (!plant.days[dayKey]) plant.days[dayKey] = {};
    if (imagePath) plant.days[dayKey].image = imagePath;
    plant.days[dayKey].feedback = feedback || '';
    
    savePlantData(plant);
    res.json({ success: true, message: 'Plant info saved!' });
});

// Clear all data
app.post('/api/plant/clear', (req, res) => {
    if (fs.existsSync(DATA_FILE)) {
        fs.unlinkSync(DATA_FILE);
    }
    res.json({ success: true, message: 'Data cleared!' });
});

// Search about plant (updates constants.about)
app.post('/api/plant/enhance', async (req, res) => {
    const plant = getPlantData();
    if (!plant) return res.status(400).json({ error: 'No plant saved.' });

    const plantName = plant.name;
    console.log(`Enhancing plant: ${plantName}`);

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-001:generateContent?key=${apiKey}`;

    const prompt = `Write a factual 1-2 paragraph description about the plant "${plantName}". Include basic/complex care info and other relevant information such as exact temperature and humidity that it needs and other numerical info.`;

    const apiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }]
        })
    });

    const apiResult = await apiResponse.json();
    if (apiResult.error) return res.status(500).json({ error: apiResult.error.message });

    const generatedText = apiResult.candidates[0].content.parts[0].text;
    plant.about = generatedText;
    savePlantData(plant);
    
    res.json({ success: true, about: generatedText });
});

// Get weather (saves to current day + next day)
app.post('/api/plant/weather', async (req, res) => {
    const plant = getPlantData();
    if (!plant) return res.status(400).json({ error: 'No plant saved.' });

    const city = plant.city;
    const currentDay = plant.currentDay;
    const dayKey = `day${currentDay}`;
    const nextDayKey = `day${currentDay + 1}`;

    console.log(`Getting weather for ${city} on Day ${currentDay}`);

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-001:generateContent?key=${apiKey}`;

    const prompt = `Search for weather in ${city} for today and tomorrow. 
    For each day, provide: High and Low temperatures in Celsius, Humidity, Sunrise time, Sunset time, and Total Daylight Hours.
    Format as exactly 2 lines:
    Line 1: "High [X]°C, Low [Y]°C, Humidity [Z]%, Sunrise [time], Sunset [time], Daylight [hours]" (for today)
    Line 2: "High [X]°C, Low [Y]°C, Humidity [Z]%, Sunrise [time], Sunset [time], Daylight [hours]" (for tomorrow)
    Do NOT include any prefixes like "Today:" or "Tomorrow:" - just the weather data.`;

    const apiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }]
        })
    });

    const apiResult = await apiResponse.json();
    if (apiResult.error) return res.status(500).json({ error: apiResult.error.message });

    const weatherText = apiResult.candidates[0].content.parts[0].text;
    const lines = weatherText.trim().split('\n').filter(l => l.trim());
    
    // Save weather to current day and next day
    if (!plant.days[dayKey]) plant.days[dayKey] = {};
    plant.days[dayKey].weather = lines[0] || weatherText;
    
    // Save tomorrow's weather too (no day limit)
    if (lines[1]) {
        if (!plant.days[nextDayKey]) plant.days[nextDayKey] = {};
        plant.days[nextDayKey].weather = lines[1];
    }
    
    savePlantData(plant);
    res.json({ success: true, weather: weatherText, day: currentDay });
});

// Analyze plant color (saves to current day)
app.post('/api/plant/color', async (req, res) => {
    const plant = getPlantData();
    if (!plant) return res.status(400).json({ error: 'No plant saved.' });

    const currentDay = plant.currentDay;
    const dayKey = `day${currentDay}`;
    const dayData = plant.days[dayKey] || {};
    
    if (!dayData.image) return res.status(400).json({ error: 'No image for current day.' });

    console.log(`Analyzing color for Day ${currentDay}`);

    const fullPath = path.join(__dirname, 'public', dayData.image);
    const imageBuffer = fs.readFileSync(fullPath);
    const base64Image = imageBuffer.toString('base64');

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

    const prompt = `Analyze this image of a plant. Determine the average color of the PLANT itself (not the background, pot, or soil - just the plant leaves/stems). Return ONLY the hex color code in the format #XXXXXX. Nothing else.`;

    const apiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: "image/png", data: base64Image } }
                ]
            }]
        })
    });

    const apiResult = await apiResponse.json();
    if (apiResult.error) return res.status(500).json({ error: apiResult.error.message });

    const colorText = apiResult.candidates[0].content.parts[0].text.trim();
    plant.days[dayKey].plantColor = colorText;
    savePlantData(plant);
    
    res.json({ success: true, color: colorText });
});

// Count leaves (saves to current day)
app.post('/api/plant/leafcount', async (req, res) => {
    const plant = getPlantData();
    if (!plant) return res.status(400).json({ error: 'No plant saved.' });

    const currentDay = plant.currentDay;
    const dayKey = `day${currentDay}`;
    const dayData = plant.days[dayKey] || {};
    
    if (!dayData.image) return res.status(400).json({ error: 'No image for current day.' });

    console.log(`Counting leaves for Day ${currentDay}`);

    const fullPath = path.join(__dirname, 'public', dayData.image);
    const imageBuffer = fs.readFileSync(fullPath);
    const base64Image = imageBuffer.toString('base64');

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

    const prompt = `Analyze this image of a plant. Count the number of visible leaves on the plant. Return ONLY a single number representing the leaf count. Nothing else.`;

    const apiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: "image/png", data: base64Image } }
                ]
            }]
        })
    });

    const apiResult = await apiResponse.json();
    if (apiResult.error) return res.status(500).json({ error: apiResult.error.message });

    const leafCount = apiResult.candidates[0].content.parts[0].text.trim();
    plant.days[dayKey].leafCount = leafCount;
    savePlantData(plant);
    
    res.json({ success: true, leafCount: leafCount });
});

// Check for infections (saves to current day)
app.post('/api/plant/infections', async (req, res) => {
    const plant = getPlantData();
    if (!plant) return res.status(400).json({ error: 'No plant saved.' });

    const currentDay = plant.currentDay;
    const dayKey = `day${currentDay}`;
    const dayData = plant.days[dayKey] || {};
    const plantName = plant.name;
    const aboutInfo = plant.about || 'No plant info available';
    
    if (!dayData.image) return res.status(400).json({ error: 'No image for current day.' });

    console.log(`Checking infections for ${plantName} on Day ${currentDay}`);

    const fullPath = path.join(__dirname, 'public', dayData.image);
    const imageBuffer = fs.readFileSync(fullPath);
    const base64Image = imageBuffer.toString('base64');

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

    const prompt = `This is a "${plantName}" plant on Day ${currentDay}.

Plant care information:
${aboutInfo}

Analyze this image of the plant for any signs of disease, infection, pest damage, or health issues based on the plant type and its care requirements.
If the plant appears healthy, respond with: "Healthy - No infections detected"
If you detect any issues, describe them briefly in 1-2 sentences including the type of infection/disease if identifiable.`;

    const apiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: "image/png", data: base64Image } }
                ]
            }]
        })
    });

    const apiResult = await apiResponse.json();
    if (apiResult.error) return res.status(500).json({ error: apiResult.error.message });

    const infections = apiResult.candidates[0].content.parts[0].text.trim();
    plant.days[dayKey].infections = infections;
    savePlantData(plant);
    
    res.json({ success: true, infections: infections });
});

// Analyze growth stage (saves to current day)
app.post('/api/plant/growth', async (req, res) => {
    const plant = getPlantData();
    if (!plant) return res.status(400).json({ error: 'No plant saved.' });

    const currentDay = plant.currentDay;
    const dayKey = `day${currentDay}`;
    const dayData = plant.days[dayKey] || {};
    const plantName = plant.name;
    
    if (!dayData.image) return res.status(400).json({ error: 'No image for current day.' });

    console.log(`Analyzing growth stage for ${plantName} on Day ${currentDay}`);

    const fullPath = path.join(__dirname, 'public', dayData.image);
    const imageBuffer = fs.readFileSync(fullPath);
    const base64Image = imageBuffer.toString('base64');

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

    const leafCount = dayData.leafCount || 'unknown';
    const plantColor = dayData.plantColor || 'unknown';

    const prompt = `The plant is a "${plantName}" and the photo was taken on "Day ${currentDay}".
Additional context:
- Current leaf count: ${leafCount}
- Current plant color: ${plantColor}

Search online for growth stages of ${plantName} plants and analyze this image along with the provided context.
Identify its growth stage from these options:
- Seedling
- Early Vegetative
- Vegetative
- Flowering
- Fruiting
- Mature

Return ONLY a JSON object in this exact format:
{"stage": "<stage>"}`;

    const apiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: "image/png", data: base64Image } }
                ]
            }],
            tools: [{ google_search: {} }]
        })
    });

    const apiResult = await apiResponse.json();
    if (apiResult.error) return res.status(500).json({ error: apiResult.error.message });

    const aiText = apiResult.candidates[0].content.parts[0].text.trim();
    
    // Parse JSON from response
    let stage = aiText;
    try {
        const jsonMatch = aiText.match(/\{.*\}/s);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            stage = parsed.stage;
        }
    } catch (e) {
        console.log("Could not parse JSON, using raw text");
    }
    
    plant.days[dayKey].growthStage = stage;
    savePlantData(plant);
    
    res.json({ success: true, stage: stage });
});

// Generate predicted image for next day
app.post('/api/plant/predict', async (req, res) => {
    const plant = getPlantData();
    if (!plant) return res.status(400).json({ error: 'No plant saved.' });

    const currentDay = plant.currentDay;
    const dayKey = `day${currentDay}`;
    const nextDayKey = `day${currentDay + 1}`;
    const dayData = plant.days[dayKey] || {};
    const plantName = plant.name;
    
    if (!dayData.image) return res.status(400).json({ error: 'No real image for current day.' });

    console.log(`Generating predicted image for Day ${currentDay + 1} from real Day ${currentDay} image`);

    // Read the real image
    const fullPath = path.join(__dirname, 'public', dayData.image);
    const imageBuffer = fs.readFileSync(fullPath);
    const base64Image = imageBuffer.toString('base64');

    const apiKey = process.env.GEMINI_API_KEY;
    
    // Use Gemini 3 Pro Image (Nano Banana Pro) for image generation
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`;

    const prompt = `Generate a photorealistic image of this ${plantName} plant as it would look tomorrow (Day ${currentDay + 1}). 
Keep the pot, soil, and background identical. 
Only simulate extremely subtle growth (1mm taller, slightly larger leaves). 
Maintain high fidelity to the original image.`;

    const apiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: "image/png", data: base64Image } }
                ]
            }],
            generationConfig: {
                responseModalities: ["image"],
                temperature: 0.4
            }
        })
    });

    const apiResult = await apiResponse.json();
    console.log("Predict API Response:", JSON.stringify(apiResult, null, 2).substring(0, 500));

    if (apiResult.error) return res.status(500).json({ error: apiResult.error.message });

    // Look for image in response (handle both camelCase and snake_case)
    let predictedImageBase64 = null;
    const parts = apiResult.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
        // Try inlineData (camelCase) first, then inline_data (snake_case)
        const inlineData = part.inlineData || part.inline_data;
        if (inlineData && inlineData.data) {
            predictedImageBase64 = inlineData.data;
            break;
        }
    }

    if (!predictedImageBase64) {
        return res.status(500).json({ error: 'No image generated in response' });
    }

    // Save predicted image to file
    const sanitizedName = (plantName || 'plant').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const predictedFilename = `${sanitizedName}_day${currentDay + 1}_predicted.png`;
    const predictedPath = path.join(UPLOADS_DIR, predictedFilename);
    fs.writeFileSync(predictedPath, Buffer.from(predictedImageBase64, 'base64'));

    // Save to current day's predictedImage field
    plant.days[dayKey].predictedImage = `uploads/${predictedFilename}`;
    
    // Also save to next day's predictedImage field for reference
    if (!plant.days[nextDayKey]) plant.days[nextDayKey] = {};
    plant.days[nextDayKey].predictedFromPrevious = `uploads/${predictedFilename}`;
    
    savePlantData(plant);
    
    console.log(`Predicted image saved: ${predictedFilename}`);
    res.json({ success: true, predictedImage: `uploads/${predictedFilename}` });
});

// Identify plant using Plant.id API (Kindwise)
app.post('/api/plant/identify', async (req, res) => {
    console.log('--- START IDENTIFY REQUEST ---');
    const plant = getPlantData();
    if (!plant) {
        console.log('Error: No plant saved');
        return res.status(400).json({ error: 'No plant saved.' });
    }

    const currentDay = plant.currentDay;
    const dayKey = `day${currentDay}`;
    const dayData = plant.days[dayKey] || {};
    
    if (!dayData.image) {
        console.log('Error: No image for current day');
        return res.status(400).json({ error: 'No image for current day.' });
    }

    console.log(`Identifying plant on Day ${currentDay}`);
    console.log(`Image path: ${dayData.image}`);

    const fullPath = path.join(__dirname, 'public', dayData.image);
    const imageBuffer = fs.readFileSync(fullPath);
    const base64Image = imageBuffer.toString('base64');
    console.log('Image read and converted to base64');

    const apiKey = process.env.PLANT_ID_API_KEY;
    console.log(`Using API Key: ${apiKey}`);
    
    console.log('Sending request to https://plant.id/api/v3/identification ...');

    // NO TRY/CATCH AS REQUESTED - RAW ERRORS WILL SHOW IN CONSOLE
    const apiResponse = await fetch('https://plant.id/api/v3/identification', {
        method: 'POST',
        headers: {
            'Api-Key': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            images: [`data:image/png;base64,${base64Image}`],
            similar_images: true
        })
    });

    console.log(`Response Status: ${apiResponse.status} ${apiResponse.statusText}`);

    const result = await apiResponse.json();
    console.log('--- RAW API RESPONSE ---');
    console.log(JSON.stringify(result, null, 2));
    console.log('--- END RAW RESPONSE ---');

    if (result.result && result.result.classification && result.result.classification.suggestions) {
        console.log('Found suggestions!');
        const suggestions = result.result.classification.suggestions.slice(0, 5);
        const formatted = suggestions.map((s, i) => ({
            rank: i + 1,
            name: s.name,
            probability: Math.round(s.probability * 100),
            similar_images: s.similar_images ? s.similar_images.slice(0, 2) : []
        }));
        res.json({ success: true, suggestions: formatted });
    } else {
        console.log('No suggestions found or unexpected format.');
        res.json({ success: true, suggestions: [], raw: result });
    }
    console.log('--- END IDENTIFY REQUEST ---');
});

// Actionable Insights
app.post('/api/plant/insights', async (req, res) => {
    const plant = getPlantData();
    if (!plant) return res.status(400).json({ error: 'No plant saved.' });

    const currentDay = plant.currentDay;
    const dayKey = `day${currentDay}`;
    const prevDayKey = `day${currentDay - 1}`;
    
    const dayData = plant.days[dayKey] || {};
    const prevData = plant.days[prevDayKey] || {};

    console.log(`Generating insights for Day ${currentDay}`);

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-001:generateContent?key=${apiKey}`;

    // Construct Context
    const context = `
    Plant Name: ${plant.name}
    Location: ${plant.city}, ${plant.indoorLocation}
    About: ${plant.about || 'N/A'}
    
    Current Day (${currentDay}) Data:
    - Weather: ${dayData.weather || 'N/A'}
    - Leaf Count: ${dayData.leafCount || 'N/A'}
    - Color: ${dayData.plantColor || 'N/A'}
    - Growth Stage: ${dayData.growthStage || 'N/A'}
    - Health/Infections: ${dayData.infections || 'N/A'}
    
    Previous Day (${currentDay - 1}) Data:
    - Weather: ${prevData.weather || 'N/A'}
    - Leaf Count: ${prevData.leafCount || 'N/A'}
    - Color: ${prevData.plantColor || 'N/A'}
    - Health: ${prevData.infections || 'N/A'}
    `;

    const prompt = `You are a plant care expert. Analyze the data above for a ${plant.name} plant on Day ${currentDay}.
    Compare it with the previous day if relevant.
    Identify any main issues or positive signs.
    Provide 3-5 specific, actionable insights or tasks for the user to perform today to improve or maintain the plant's health.
    Keep the tone helpful and concise. Format as a bulleted list.`;

    try {
        const apiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: context + "\n\n" + prompt }] }]
            })
        });

        const apiResult = await apiResponse.json();
        if (apiResult.error) return res.status(500).json({ error: apiResult.error.message });

        const insights = apiResult.candidates[0].content.parts[0].text;
        
        // Save insights to day data? User didn't strictly ask to persist, but good practice.
        // Let's not persist heavily to avoid overwriting unless requested, but caching nice.
        // User said "show actionable insights". I'll return it.
        
        res.json({ success: true, insights: insights });
    } catch (e) {
        console.error("Insights Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// =====================================
// TEST MODE ENDPOINTS (No JSON persistence)
// =====================================

// In-memory storage for test mode (resets on server restart)
let testPlantData = null;

// Serve test page
app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'test.html'));
});

// Get test plant data (from memory)
app.get('/api/test/plant', (req, res) => {
    res.json({ plant: testPlantData });
});

// Save test plant data (to memory only)
app.post('/api/test/plant', (req, res) => {
    const { name, city, indoorLocation, dayOfPlanting, feedback, image } = req.body;
    
    const dayNum = parseInt(dayOfPlanting.replace(/\D/g, '')) || 1;
    const dayKey = `day${dayNum}`;
    
    if (!testPlantData) {
        testPlantData = {
            name: name,
            city: city,
            indoorLocation: indoorLocation,
            about: null,
            currentDay: dayNum,
            days: {}
        };
        for (let i = 1; i <= 45; i++) {
            testPlantData.days[`day${i}`] = {};
        }
    } else {
        testPlantData.name = name;
        testPlantData.city = city;
        testPlantData.indoorLocation = indoorLocation;
        testPlantData.currentDay = dayNum;
    }
    
    // Handle image - store as base64 in memory
    let imagePath = null;
    if (image && image.startsWith('data:image')) {
        // For test mode, store the base64 data directly
        imagePath = image;
    }
    
    if (!testPlantData.days[dayKey]) testPlantData.days[dayKey] = {};
    if (imagePath) testPlantData.days[dayKey].image = imagePath;
    testPlantData.days[dayKey].feedback = feedback || '';
    
    res.json({ success: true, message: 'Test plant info saved (in memory)!' });
});

// Clear test data
app.post('/api/test/plant/clear', (req, res) => {
    testPlantData = null;
    res.json({ success: true, message: 'Test data cleared!' });
});

// Test: Enhance plant about
app.post('/api/test/plant/enhance', async (req, res) => {
    if (!testPlantData) return res.status(400).json({ error: 'No test plant data.' });

    const plantName = testPlantData.name;
    console.log(`[TEST] Enhancing plant: ${plantName}`);

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-001:generateContent?key=${apiKey}`;

    const prompt = `Write a factual 1-2 paragraph description about the plant "${plantName}". Include basic/complex care info and other relevant information such as exact temperature and humidity that it needs and other numerical info.`;

    const apiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }]
        })
    });

    const apiResult = await apiResponse.json();
    if (apiResult.error) return res.status(500).json({ error: apiResult.error.message });

    const generatedText = apiResult.candidates[0].content.parts[0].text;
    testPlantData.about = generatedText;
    
    res.json({ success: true, about: generatedText });
});

// Test: Get weather
app.post('/api/test/plant/weather', async (req, res) => {
    if (!testPlantData) return res.status(400).json({ error: 'No test plant data.' });

    const city = testPlantData.city;
    const currentDay = testPlantData.currentDay;
    const dayKey = `day${currentDay}`;
    const nextDayKey = `day${currentDay + 1}`;

    console.log(`[TEST] Getting weather for ${city} on Day ${currentDay}`);

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-001:generateContent?key=${apiKey}`;

    const prompt = `Search for weather in ${city} for today and tomorrow. 
    For each day, provide: High and Low temperatures in Celsius, Humidity, Sunrise time, Sunset time, and Total Daylight Hours.
    Format as exactly 2 lines:
    Line 1: "High [X]°C, Low [Y]°C, Humidity [Z]%, Sunrise [time], Sunset [time], Daylight [hours]" (for today)
    Line 2: "High [X]°C, Low [Y]°C, Humidity [Z]%, Sunrise [time], Sunset [time], Daylight [hours]" (for tomorrow)
    Do NOT include any prefixes like "Today:" or "Tomorrow:" - just the weather data.`;

    const apiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }]
        })
    });

    const apiResult = await apiResponse.json();
    if (apiResult.error) return res.status(500).json({ error: apiResult.error.message });

    const weatherText = apiResult.candidates[0].content.parts[0].text;
    const lines = weatherText.trim().split('\n').filter(l => l.trim());
    
    if (!testPlantData.days[dayKey]) testPlantData.days[dayKey] = {};
    testPlantData.days[dayKey].weather = lines[0] || weatherText;
    
    if (currentDay < 45 && lines[1]) {
        if (!testPlantData.days[nextDayKey]) testPlantData.days[nextDayKey] = {};
        testPlantData.days[nextDayKey].weather = lines[1];
    }
    
    res.json({ success: true, weather: weatherText, day: currentDay });
});

// Test: Analyze color
app.post('/api/test/plant/color', async (req, res) => {
    if (!testPlantData) return res.status(400).json({ error: 'No test plant data.' });

    const currentDay = testPlantData.currentDay;
    const dayKey = `day${currentDay}`;
    const dayData = testPlantData.days[dayKey] || {};
    
    if (!dayData.image) return res.status(400).json({ error: 'No image for current day.' });

    console.log(`[TEST] Analyzing color for Day ${currentDay}`);

    // Extract base64 from data URL
    let base64Image = dayData.image;
    if (base64Image.startsWith('data:image')) {
        base64Image = base64Image.replace(/^data:image\/\w+;base64,/, "");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

    const prompt = `Analyze this image of a plant. Determine the average color of the PLANT itself (not the background, pot, or soil - just the plant leaves/stems). Return ONLY the hex color code in the format #XXXXXX. Nothing else.`;

    const apiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: "image/png", data: base64Image } }
                ]
            }]
        })
    });

    const apiResult = await apiResponse.json();
    if (apiResult.error) return res.status(500).json({ error: apiResult.error.message });

    const colorText = apiResult.candidates[0].content.parts[0].text.trim();
    testPlantData.days[dayKey].plantColor = colorText;
    
    res.json({ success: true, color: colorText });
});

// Test: Leaf count
app.post('/api/test/plant/leafcount', async (req, res) => {
    if (!testPlantData) return res.status(400).json({ error: 'No test plant data.' });

    const currentDay = testPlantData.currentDay;
    const dayKey = `day${currentDay}`;
    const dayData = testPlantData.days[dayKey] || {};
    
    if (!dayData.image) return res.status(400).json({ error: 'No image for current day.' });

    console.log(`[TEST] Counting leaves for Day ${currentDay}`);

    let base64Image = dayData.image;
    if (base64Image.startsWith('data:image')) {
        base64Image = base64Image.replace(/^data:image\/\w+;base64,/, "");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

    const prompt = `Analyze this image of a plant. Count the number of visible leaves on the plant. Return ONLY a single number representing the leaf count. Nothing else.`;

    const apiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: "image/png", data: base64Image } }
                ]
            }]
        })
    });

    const apiResult = await apiResponse.json();
    if (apiResult.error) return res.status(500).json({ error: apiResult.error.message });

    const leafCount = apiResult.candidates[0].content.parts[0].text.trim();
    testPlantData.days[dayKey].leafCount = leafCount;
    
    res.json({ success: true, leafCount: leafCount });
});

// Test: Check infections
app.post('/api/test/plant/infections', async (req, res) => {
    if (!testPlantData) return res.status(400).json({ error: 'No test plant data.' });

    const currentDay = testPlantData.currentDay;
    const dayKey = `day${currentDay}`;
    const dayData = testPlantData.days[dayKey] || {};
    const plantName = testPlantData.name;
    const aboutInfo = testPlantData.about || 'No plant info available';
    
    if (!dayData.image) return res.status(400).json({ error: 'No image for current day.' });

    console.log(`[TEST] Checking infections for ${plantName} on Day ${currentDay}`);

    let base64Image = dayData.image;
    if (base64Image.startsWith('data:image')) {
        base64Image = base64Image.replace(/^data:image\/\w+;base64,/, "");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

    const prompt = `This is a "${plantName}" plant on Day ${currentDay}.

Plant care information:
${aboutInfo}

Analyze this image of the plant for any signs of disease, infection, pest damage, or health issues based on the plant type and its care requirements.
If the plant appears healthy, respond with: "Healthy - No infections detected"
If you detect any issues, describe them briefly in 1-2 sentences including the type of infection/disease if identifiable.`;

    const apiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: "image/png", data: base64Image } }
                ]
            }]
        })
    });

    const apiResult = await apiResponse.json();
    if (apiResult.error) return res.status(500).json({ error: apiResult.error.message });

    const infections = apiResult.candidates[0].content.parts[0].text.trim();
    testPlantData.days[dayKey].infections = infections;
    
    res.json({ success: true, infections: infections });
});

// Test: Growth stage
app.post('/api/test/plant/growth', async (req, res) => {
    if (!testPlantData) return res.status(400).json({ error: 'No test plant data.' });

    const currentDay = testPlantData.currentDay;
    const dayKey = `day${currentDay}`;
    const dayData = testPlantData.days[dayKey] || {};
    const plantName = testPlantData.name;
    
    if (!dayData.image) return res.status(400).json({ error: 'No image for current day.' });

    console.log(`[TEST] Analyzing growth stage for ${plantName} on Day ${currentDay}`);

    let base64Image = dayData.image;
    if (base64Image.startsWith('data:image')) {
        base64Image = base64Image.replace(/^data:image\/\w+;base64,/, "");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

    const leafCount = dayData.leafCount || 'unknown';
    const plantColor = dayData.plantColor || 'unknown';

    const prompt = `The plant is a "${plantName}" and the photo was taken on "Day ${currentDay}".
Additional context:
- Current leaf count: ${leafCount}
- Current plant color: ${plantColor}

Search online for growth stages of ${plantName} plants and analyze this image along with the provided context.
Identify its growth stage from these options:
- Seedling
- Early Vegetative
- Vegetative
- Flowering
- Fruiting
- Mature

Return ONLY a JSON object in this exact format:
{"stage": "<stage>"}`;

    const apiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: "image/png", data: base64Image } }
                ]
            }],
            tools: [{ google_search: {} }]
        })
    });

    const apiResult = await apiResponse.json();
    if (apiResult.error) return res.status(500).json({ error: apiResult.error.message });

    const aiText = apiResult.candidates[0].content.parts[0].text.trim();
    
    let stage = aiText;
    try {
        const jsonMatch = aiText.match(/\{.*\}/s);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            stage = parsed.stage;
        }
    } catch (e) {
        console.log("[TEST] Could not parse JSON, using raw text");
    }
    
    testPlantData.days[dayKey].growthStage = stage;
    
    res.json({ success: true, stage: stage });
});

// Test: Predict next day image
app.post('/api/test/plant/predict', async (req, res) => {
    if (!testPlantData) return res.status(400).json({ error: 'No test plant data.' });

    const currentDay = testPlantData.currentDay;
    const dayKey = `day${currentDay}`;
    const nextDayKey = `day${currentDay + 1}`;
    const dayData = testPlantData.days[dayKey] || {};
    const plantName = testPlantData.name;
    
    if (!dayData.image) return res.status(400).json({ error: 'No real image for current day.' });

    console.log(`[TEST] Generating predicted image for Day ${currentDay + 1}`);

    let base64Image = dayData.image;
    if (base64Image.startsWith('data:image')) {
        base64Image = base64Image.replace(/^data:image\/\w+;base64,/, "");
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`;

    const prompt = `Generate a photorealistic image of this ${plantName} plant as it would look tomorrow (Day ${currentDay + 1}). 
Keep the pot, soil, and background identical. 
Only simulate extremely subtle growth (1mm taller, slightly larger leaves). 
Maintain high fidelity to the original image.`;

    const apiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: "image/png", data: base64Image } }
                ]
            }],
            generationConfig: {
                responseModalities: ["image"],
                temperature: 0.4
            }
        })
    });

    const apiResult = await apiResponse.json();
    console.log("[TEST] Predict API Response:", JSON.stringify(apiResult, null, 2).substring(0, 500));

    if (apiResult.error) return res.status(500).json({ error: apiResult.error.message });

    let predictedImageBase64 = null;
    const parts = apiResult.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
        const inlineData = part.inlineData || part.inline_data;
        if (inlineData && inlineData.data) {
            predictedImageBase64 = inlineData.data;
            break;
        }
    }

    if (!predictedImageBase64) {
        return res.status(500).json({ error: 'No image generated in response' });
    }

    // Store as data URL in memory
    const predictedDataUrl = `data:image/png;base64,${predictedImageBase64}`;
    
    testPlantData.days[dayKey].predictedImage = predictedDataUrl;
    
    if (!testPlantData.days[nextDayKey]) testPlantData.days[nextDayKey] = {};
    testPlantData.days[nextDayKey].predictedFromPrevious = predictedDataUrl;
    
    console.log(`[TEST] Predicted image stored in memory`);
    res.json({ success: true, predictedImage: predictedDataUrl });
});

// Test: Identify plant
app.post('/api/test/plant/identify', async (req, res) => {
    console.log('[TEST] --- START IDENTIFY REQUEST ---');
    if (!testPlantData) {
        console.log('[TEST] Error: No test plant data');
        return res.status(400).json({ error: 'No test plant data.' });
    }

    const currentDay = testPlantData.currentDay;
    const dayKey = `day${currentDay}`;
    const dayData = testPlantData.days[dayKey] || {};
    
    if (!dayData.image) {
        console.log('[TEST] Error: No image for current day');
        return res.status(400).json({ error: 'No image for current day.' });
    }

    console.log(`[TEST] Identifying plant on Day ${currentDay}`);

    let base64Image = dayData.image;
    if (base64Image.startsWith('data:image')) {
        base64Image = base64Image.replace(/^data:image\/\w+;base64,/, "");
    }

    const apiKey = process.env.PLANT_ID_API_KEY;
    
    console.log('[TEST] Sending request to https://plant.id/api/v3/identification ...');

    const apiResponse = await fetch('https://plant.id/api/v3/identification', {
        method: 'POST',
        headers: {
            'Api-Key': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            images: [`data:image/png;base64,${base64Image}`],
            similar_images: true
        })
    });

    console.log(`[TEST] Response Status: ${apiResponse.status} ${apiResponse.statusText}`);

    const result = await apiResponse.json();
    console.log('[TEST] --- RAW API RESPONSE ---');
    console.log(JSON.stringify(result, null, 2).substring(0, 1000));
    console.log('[TEST] --- END RAW RESPONSE ---');

    if (result.result && result.result.classification && result.result.classification.suggestions) {
        console.log('[TEST] Found suggestions!');
        const suggestions = result.result.classification.suggestions.slice(0, 5);
        const formatted = suggestions.map((s, i) => ({
            rank: i + 1,
            name: s.name,
            probability: Math.round(s.probability * 100),
            similar_images: s.similar_images ? s.similar_images.slice(0, 2) : []
        }));
        res.json({ success: true, suggestions: formatted });
    } else {
        console.log('[TEST] No suggestions found or unexpected format.');
        res.json({ success: true, suggestions: [], raw: result });
    }
    console.log('[TEST] --- END IDENTIFY REQUEST ---');
});

// Test: Get insights
app.post('/api/test/plant/insights', async (req, res) => {
    if (!testPlantData) return res.status(400).json({ error: 'No test plant data.' });

    const currentDay = testPlantData.currentDay;
    const dayKey = `day${currentDay}`;
    const prevDayKey = `day${currentDay - 1}`;
    
    const dayData = testPlantData.days[dayKey] || {};
    const prevData = testPlantData.days[prevDayKey] || {};

    console.log(`[TEST] Generating insights for Day ${currentDay}`);

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-001:generateContent?key=${apiKey}`;

    const context = `
    Plant Name: ${testPlantData.name}
    Location: ${testPlantData.city}, ${testPlantData.indoorLocation}
    About: ${testPlantData.about || 'N/A'}
    
    Current Day (${currentDay}) Data:
    - Weather: ${dayData.weather || 'N/A'}
    - Leaf Count: ${dayData.leafCount || 'N/A'}
    - Color: ${dayData.plantColor || 'N/A'}
    - Growth Stage: ${dayData.growthStage || 'N/A'}
    - Health/Infections: ${dayData.infections || 'N/A'}
    
    Previous Day (${currentDay - 1}) Data:
    - Weather: ${prevData.weather || 'N/A'}
    - Leaf Count: ${prevData.leafCount || 'N/A'}
    - Color: ${prevData.plantColor || 'N/A'}
    - Health: ${prevData.infections || 'N/A'}
    `;

    const prompt = `You are a plant care expert. Analyze the data above for a ${testPlantData.name} plant on Day ${currentDay}.
    Compare it with the previous day if relevant.
    Identify any main issues or positive signs.
    Provide 3-5 specific, actionable insights or tasks for the user to perform today to improve or maintain the plant's health.
    Keep the tone helpful and concise. Format as a bulleted list.`;

    try {
        const apiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: context + "\n\n" + prompt }] }]
            })
        });

        const apiResult = await apiResponse.json();
        if (apiResult.error) return res.status(500).json({ error: apiResult.error.message });

        const insights = apiResult.candidates[0].content.parts[0].text;
        res.json({ success: true, insights: insights });
    } catch (e) {
        console.error("[TEST] Insights Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Test mode available at http://localhost:${PORT}/test`);
});
