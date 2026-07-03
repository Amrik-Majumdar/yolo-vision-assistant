import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

// Make sure logs folder exists
const logsFolder = path.join(__dirname, "../../logs");
await fs.mkdir(logsFolder, { recursive: true });

// Main endpoint - receives image and detections, returns AI analysis
router.post("/", async (req, res) => {
  try {
    const { image, detections } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }

    console.log(`Got ${detections?.length || 0} detections to analyze`);

    let description = "";
    let aiAnalysis = null;
    
    // If we have detections, get AI to explain the scene
    if (detections && detections.length > 0) {
      const aiResult = await analyzeSceneWithAI(image, detections);
      description = aiResult.description;
      aiAnalysis = aiResult.analysis;
    } else {
      description = "No objects found in the image.";
    }

    // Save this detection to our logs
    const logEntry = await saveToLog({
      timestamp: new Date().toISOString(),
      detections: detections,
      description: description,
      imageSize: image.length
    });

    // Send back the results
    res.json({
      success: true,
      description: description,
      count: detections?.length || 0,
      detections: detections || [],
      logId: logEntry.id,
      analysis: aiAnalysis,
      timestamp: logEntry.timestamp
    });

  } catch (error) {
    console.error("Error in explain endpoint:", error);
    res.status(500).json({ 
      error: "Something went wrong",
      message: error.message 
    });
  }
});

// Use Claude AI to understand the scene
async function analyzeSceneWithAI(imageData, detections) {
  try {
    // Create a summary of what was detected
    const detectionSummary = detections
      .map(d => `${d.label} (${Math.round(d.score * 100)}% confident)`)
      .join(", ");

    // Call Claude API
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: imageData.split(',')[1] || imageData
                }
              },
              {
                type: "text",
                text: `I'm building an assistive vision system. The object detector found: ${detectionSummary}.

Please analyze this scene and provide:
1. A natural description someone could understand (2-3 sentences)
2. How objects are positioned relative to each other
3. What seems to be happening in this scene
4. Any safety concerns worth mentioning
5. Details that would help someone who can't see

Give me your response as JSON like this:
{
  "description": "The natural description for speech output",
  "spatial": "How things are positioned",
  "context": "What's happening",
  "safety": "Any safety notes",
  "accessibility": "Helpful accessibility details"
}`
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API returned ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.content
      .filter(block => block.type === "text")
      .map(block => block.text)
      .join("\n");

    // Try to parse the JSON response
    let analysis;
    try {
      const cleanedJson = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysis = JSON.parse(cleanedJson);
    } catch (parseError) {
      // If JSON parsing fails, just use the text as description
      analysis = {
        description: responseText,
        spatial: "",
        context: "",
        safety: "",
        accessibility: ""
      };
    }

    return {
      description: analysis.description,
      analysis: analysis
    };

  } catch (error) {
    console.error("AI analysis failed:", error);
    
    // Fall back to basic description if AI fails
    const objects = detections
      .map(d => d.label)
      .filter((value, index, self) => self.indexOf(value) === index)
      .join(", ");
    
    return {
      description: `I can see ${objects} in the image.`,
      analysis: null
    };
  }
}

// Save detection to log files
async function saveToLog(data) {
  try {
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const logFile = path.join(logsFolder, `${logId}.json`);
    
    const logEntry = {
      id: logId,
      ...data
    };

    // Save individual log file
    await fs.writeFile(logFile, JSON.stringify(logEntry, null, 2));
    console.log(`Saved log: ${logId}`);

    // Also append to daily log file
    const today = new Date().toISOString().split('T')[0];
    const dailyLog = path.join(logsFolder, `daily_${today}.jsonl`);
    await fs.appendFile(dailyLog, JSON.stringify(logEntry) + "\n");

    return logEntry;

  } catch (error) {
    console.error("Couldn't save log:", error);
    return {
      id: "error",
      timestamp: data.timestamp
    };
  }
}

// Get recent logs
router.get("/logs", async (req, res) => {
  try {
    const howMany = parseInt(req.query.limit) || 10;
    const allFiles = await fs.readdir(logsFolder);
    
    // Get only the individual log files (not daily logs)
    const logFiles = allFiles
      .filter(filename => filename.startsWith("log_") && filename.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, howMany);

    const logs = await Promise.all(
      logFiles.map(async (filename) => {
        const fileContent = await fs.readFile(path.join(logsFolder, filename), "utf-8");
        return JSON.parse(fileContent);
      })
    );

    res.json({ success: true, logs: logs });

  } catch (error) {
    console.error("Couldn't get logs:", error);
    res.status(500).json({ error: "Failed to get logs" });
  }
});

// Get statistics about what's been detected
router.get("/stats", async (req, res) => {
  try {
    const allFiles = await fs.readdir(logsFolder);
    const logFiles = allFiles.filter(f => f.startsWith("log_") && f.endsWith(".json"));

    let totalDetections = 0;
    const objectCounts = {};
    
    // Go through each log and count things
    for (const filename of logFiles) {
      const fileContent = await fs.readFile(path.join(logsFolder, filename), "utf-8");
      const log = JSON.parse(fileContent);
      
      if (log.detections) {
        totalDetections += log.detections.length;
        
        log.detections.forEach(detection => {
          const label = detection.label;
          objectCounts[label] = (objectCounts[label] || 0) + 1;
        });
      }
    }

    // Sort to find most common objects
    const topObjects = Object.entries(objectCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, count]) => ({ label, count }));

    res.json({
      success: true,
      stats: {
        totalSessions: logFiles.length,
        totalDetections: totalDetections,
        topObjects: topObjects,
        allObjects: objectCounts
      }
    });

  } catch (error) {
    console.error("Couldn't get stats:", error);
    res.status(500).json({ error: "Failed to get statistics" });
  }
});

// Delete all logs
router.delete("/logs", async (req, res) => {
  try {
    const allFiles = await fs.readdir(logsFolder);
    
    for (const filename of allFiles) {
      await fs.unlink(path.join(logsFolder, filename));
    }
    
    res.json({ success: true, message: "All logs deleted" });
  } catch (error) {
    console.error("Couldn't delete logs:", error);
    res.status(500).json({ error: "Failed to delete logs" });
  }
});

export default router;