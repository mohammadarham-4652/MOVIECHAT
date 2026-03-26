import { GoogleGenAI, Type } from "@google/genai";

const apiKeys = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3
].filter(Boolean);

// Fallback to a default if no keys are provided (though the platform usually provides one)
if (apiKeys.length === 0) {
  apiKeys.push("");
}

const movieSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    year: { type: Type.STRING },
    genre: { type: Type.ARRAY, items: { type: Type.STRING } },
    rating: { type: Type.STRING },
    description: { type: Type.STRING },
    director: { type: Type.STRING },
    runtime: { type: Type.STRING },
    releaseDate: { type: Type.STRING },
    posterUrl: { type: Type.STRING, description: "A REAL, high-quality, publicly accessible URL for the movie's official poster (e.g., from TMDB, IMDb, or official movie sites)." },
    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
    isMustWatch: { type: Type.BOOLEAN }
  },
  required: ["title", "year", "genre", "rating", "description", "director", "runtime", "releaseDate", "posterUrl", "tags"]
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    analysis: { type: Type.STRING, description: "A brief analysis of the user's request and why these movies were chosen." },
    recommendations: {
      type: Type.ARRAY,
      items: movieSchema
    }
  },
  required: ["analysis", "recommendations"]
};

export async function getMovieRecommendations(prompt, history) {
  const model = "gemini-3.1-pro-preview";
  
  const contents = [
    ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })),
    { role: 'user', parts: [{ text: prompt }] }
  ];

  let lastError = null;

  // Try each key in sequence for redundancy
  for (const key of apiKeys) {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model,
        contents: contents,
        config: {
          systemInstruction: `You are "The Digital Curator", a sophisticated AI cinematic expert for the app "What'sYourMov". 
          Your goal is to recommend visually stunning, high-quality films based on user preferences.
          Focus on cinematography, mood, and philosophical themes.
          Always provide 3 recommendations.
          
          CRITICAL: You MUST provide a REAL, WORKING URL for the official movie poster. 
          Use the googleSearch tool to find the EXACT poster image URL. 
          
          STEPS TO FIND POSTER:
          1. Search for "[Movie Name] [Year] official poster image direct link".
          2. Look for URLs from:
             - image.tmdb.org (e.g., https://image.tmdb.org/t/p/w500/...)
             - m.media-amazon.com (e.g., https://m.media-amazon.com/images/M/...)
             - wikimedia.org
          3. Ensure the URL ends in .jpg, .jpeg, or .png.
          4. DO NOT hallucinate or make up a URL. If you cannot find a direct image link, provide a high-quality descriptive Unsplash URL as a last resort, but you MUST try to find the real one first.`,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          tools: [{ googleSearch: {} }]
        }
      });

      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error(`API call failed with key starting with ${key.substring(0, 8)}...:`, error);
      lastError = error;
      // Continue to next key
    }
  }

  // If all keys fail, throw the last error
  throw lastError || new Error("All API keys failed to generate content.");
}
