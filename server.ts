import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Middleware
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Routes
  app.post("/api/scan", async (req, res) => {
    try {
      const { imageBase64, mimeType, availableFolders } = req.body;

      if (!imageBase64 || !mimeType) {
        return res.status(400).json({ error: "Missing imageBase64 or mimeType" });
      }

      const prompt = `Analyze this document image. 
      1. Extract a concise title for it based on its content. Do not use quotes or prefixes, just the raw title string.
      2. Categorization: Determine a brief one-word or two-word category/folder name that this document belongs in. 
         If appropriate, please try to categorize into one of these existing folders: [${(availableFolders || []).join(", ")}]. If none match well, suggest a new short folder name.
      
      Return your answer strictly in the following JSON schema:
      {
        "title": "Document Title",
        "category": "Folder Name"
      }`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          { text: prompt },
        ],
        config: {
          responseMimeType: "application/json",
        },
      });

      let jsonStr = response.text.trim();
      // attempt to parse the json response
      const result = JSON.parse(jsonStr);

      res.json(result);
    } catch (error: any) {
      console.error("Error during scan:", error);
      res.status(500).json({ error: "Failed to scan document: " + error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // For Express 4
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
