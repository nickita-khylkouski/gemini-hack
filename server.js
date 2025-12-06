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
        // Initialize all 45 days
        for (let i = 1; i <= 45; i++) {
            plant.days[`day${i}`] = {};
        }
    } else {
        // Update constants
        plant.name = name;
        plant.city = city;
        plant.indoorLocation = indoorLocation;
        plant.currentDay = dayNum;
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

    const apiKey = 'AIzaSyD87BaGemt8-uv6D-BbFjLz9aI-1Acd_dc';
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

    const apiKey = 'AIzaSyD87BaGemt8-uv6D-BbFjLz9aI-1Acd_dc';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite-001:generateContent?key=${apiKey}`;

    const prompt = `Search for weather in ${city} for today and tomorrow. 
    For each day, provide: High and Low temperatures, Humidity, Sunrise time, Sunset time, and Total Daylight Hours.
    Format as exactly 2 lines:
    Line 1: "High [X]°F, Low [Y]°F, Humidity [Z]%, Sunrise [time], Sunset [time], Daylight [hours]" (for today)
    Line 2: "High [X]°F, Low [Y]°F, Humidity [Z]%, Sunrise [time], Sunset [time], Daylight [hours]" (for tomorrow)
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
    
    if (currentDay < 45 && lines[1]) {
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

    const apiKey = 'AIzaSyD87BaGemt8-uv6D-BbFjLz9aI-1Acd_dc';
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

    const apiKey = 'AIzaSyD87BaGemt8-uv6D-BbFjLz9aI-1Acd_dc';
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

    const apiKey = 'AIzaSyD87BaGemt8-uv6D-BbFjLz9aI-1Acd_dc';
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

    const apiKey = 'AIzaSyD87BaGemt8-uv6D-BbFjLz9aI-1Acd_dc';
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

    const apiKey = 'AIzaSyD87BaGemt8-uv6D-BbFjLz9aI-1Acd_dc';
    
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
    const plant = getPlantData();
    if (!plant) return res.status(400).json({ error: 'No plant saved.' });

    const currentDay = plant.currentDay;
    const dayKey = `day${currentDay}`;
    const dayData = plant.days[dayKey] || {};
    
    if (!dayData.image) return res.status(400).json({ error: 'No image for current day.' });

    console.log(`Identifying plant on Day ${currentDay}`);

    const fullPath = path.join(__dirname, 'public', dayData.image);
    const imageBuffer = fs.readFileSync(fullPath);
    const base64Image = imageBuffer.toString('base64');

    const apiKey = 'hl64bgSRLCqDRpgLD83MC2gWZDlMgmbjAmj2pbtKYVXla3E9SX';
    
    try {
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

        const result = await apiResponse.json();
        console.log('Plant.id response:', JSON.stringify(result, null, 2).substring(0, 1000));

        if (result.result && result.result.classification && result.result.classification.suggestions) {
            const suggestions = result.result.classification.suggestions.slice(0, 5);
            const formatted = suggestions.map((s, i) => ({
                rank: i + 1,
                name: s.name,
                probability: Math.round(s.probability * 100),
                similar_images: s.similar_images ? s.similar_images.slice(0, 2) : []
            }));
            res.json({ success: true, suggestions: formatted });
        } else {
            res.json({ success: true, suggestions: [], raw: result });
        }
    } catch (err) {
        console.error('Plant.id error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
