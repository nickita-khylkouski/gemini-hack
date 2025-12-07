import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, imageType, sensorData } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Analyzing plant image with Gemini...", { imageType, hasSensorData: !!sensorData });

    const systemPrompt = `You are an expert botanist and plant health analyst. Analyze the provided plant image and extract the following information in JSON format:

{
  "leaf_count": <number or null if not visible>,
  "average_color": "<hex color code of the dominant plant color>",
  "has_infection": <boolean>,
  "infection_details": "<description of any infections, diseases, or null if healthy>",
  "plant_angle": <angle in degrees from vertical, 0 being straight up>,
  "growth_stage": "<one of: seedling, vegetative, flowering, fruiting, harvest-ready, decline>",
  "health_score": <1-100>,
  "observations": "<brief description of plant health and notable features>",
  "recommendations": ["<array of care recommendations>"]
}

Be precise and analytical. If analyzing root/underground images, focus on root health, soil visibility, and root development stage.`;

    const userContent = [
      {
        type: "text",
        text: `Analyze this ${imageType} plant image. ${sensorData ? `Current sensor readings: Temperature: ${sensorData.temperature}°C, Soil Moisture: ${sensorData.moisture}%, Light Level: ${sensorData.sunlight}%` : ''}`
      },
      {
        type: "image_url",
        image_url: {
          url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
        }
      }
    ];

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
          { role: "user", content: userContent }
        ],
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
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const analysisText = data.choices?.[0]?.message?.content;
    
    console.log("Raw analysis response:", analysisText);

    // Extract JSON from the response
    let analysis;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse analysis:", parseError);
      analysis = {
        observations: analysisText,
        health_score: 75,
        growth_stage: "vegetative",
        recommendations: ["Unable to fully parse analysis"]
      };
    }

    // Store in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: insertedData, error: insertError } = await supabase
      .from("plant_analyses")
      .insert({
        image_type: imageType,
        leaf_count: analysis.leaf_count,
        average_color: analysis.average_color,
        has_infection: analysis.has_infection,
        infection_details: analysis.infection_details,
        plant_angle: analysis.plant_angle,
        growth_stage: analysis.growth_stage,
        soil_moisture: sensorData?.moisture,
        temperature: sensorData?.temperature,
        raw_analysis: analysis
      })
      .select()
      .single();

    if (insertError) {
      console.error("Database insert error:", insertError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      analysis,
      record: insertedData 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in analyze-plant function:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
