import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, plantContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context from plant data
    let contextInfo = "";
    
    if (plantContext) {
      const { sensorData, analysis, weather, sunlight, latestAnalyses } = plantContext;
      
      if (sensorData) {
        contextInfo += `\n\n🌱 DAILY SOIL NUTRIENT PROFILE:
- Nitrogen (N): ${sensorData.nitrogen ?? "N/A"} ppm
- Phosphorus (P): ${sensorData.phosphorus ?? "N/A"} ppm
- Potassium (K): ${sensorData.potassium ?? "N/A"} ppm
- Soil pH: ${sensorData.ph ?? "N/A"}
- Soil Moisture: ${sensorData.moisture}%
- Temperature: ${sensorData.temperature}°C
- Light Exposure: ${sensorData.sunlight}%`;
      }
      
      if (analysis) {
        contextInfo += `\n\n📊 LATEST PLANT ANALYSIS:
- Leaf Count: ${analysis.leaf_count ?? "Not counted"}
- Average Color: ${analysis.average_color ?? "Unknown"}
- Infection Status: ${analysis.has_infection ? "⚠️ DETECTED - " + analysis.infection_details : "✅ Healthy"}
- Plant Angle: ${analysis.plant_angle ?? 0}° from vertical
- Growth Stage: ${analysis.growth_stage ?? "Unknown"} (seedling → vegetative → flowering/fruiting → harvest-ready → decline)
- Health Score: ${analysis.health_score ?? "N/A"}/100
- Observations: ${analysis.observations}
- Recommendations: ${analysis.recommendations?.join(", ") || "None"}`;
      }
      
      if (weather) {
        contextInfo += `\n\nWEATHER CONDITIONS:
- Location: ${weather.location}
- Temperature: ${weather.temperature}°C
- Condition: ${weather.condition}
- Humidity: ${weather.humidity}%`;
      }
      
      if (sunlight) {
        contextInfo += `\n\nSUNLIGHT TRACKING:
- Current Hours: ${sunlight.currentHours}h
- Target Hours: ${sunlight.targetHours}h
- Sunrise: ${sunlight.sunrise}
- Sunset: ${sunlight.sunset}`;
      }
      
      if (latestAnalyses && latestAnalyses.length > 0) {
        contextInfo += `\n\nRECENT ANALYSIS HISTORY (${latestAnalyses.length} records):`;
        latestAnalyses.slice(0, 5).forEach((a: any, i: number) => {
          contextInfo += `\n${i + 1}. ${new Date(a.captured_at).toLocaleString()} - Stage: ${a.growth_stage || "Unknown"}, Leaves: ${a.leaf_count ?? "N/A"}, Infection: ${a.has_infection ? "Yes" : "No"}`;
        });
      }
    }

    const systemPrompt = `You are GrowWise, an expert AI gardening assistant for a basil plant monitoring system. You have real-time access to sensor data, plant analysis results, and environmental conditions.

CURRENT PLANT DATA:${contextInfo || "\nNo data available yet. Encourage the user to upload plant images for analysis."}

Your role:
- Provide personalized advice based on the ACTUAL current readings and analysis
- Reference specific metrics when giving recommendations
- Alert users to any concerning readings or detected issues
- Compare current conditions to ideal basil growing conditions
- Track growth progress and celebrate milestones
- Be friendly, helpful, and proactive about plant health

Ideal basil conditions for reference:
- Temperature: 18-27°C (65-80°F)
- Soil moisture: 40-60%
- pH: 6.0-7.0
- Full sun: 6-8 hours daily
- N-P-K: Balanced with slight nitrogen preference

Keep responses concise but informative. Always tie advice back to the actual data when available.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "I couldn't generate a response.";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Plant chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
