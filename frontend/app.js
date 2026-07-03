import { speak, setSpeechRate } from "./js/voice.js";
import { initYoloModel, detectFrame } from "./js/yolo/runtime.js";
import { initSmartClassifier, classifySmart, cleanClassName } from "./js/smart-classifier.js";
import { ObjectTracker } from "./js/tracker.js";

// Get all the elements
const video = document.getElementById("webcam");
const canvas = document.getElementById("canvas");
const detectBtn = document.getElementById("detectBtn");
const statusBar = document.getElementById("statusBar");
const resultsArea = document.getElementById("resultsArea");
const voiceToggle = document.getElementById("voiceToggle");
const continuousToggle = document.getElementById("continuousToggle");
const confSlider = document.getElementById("confSlider");
const confValue = document.getElementById("confValue");
const speedSlider = document.getElementById("speedSlider");
const speedValue = document.getElementById("speedValue");
const statsPanel = document.getElementById("statsPanel");
const peopleCount = document.getElementById("peopleCount");
const objectsCount = document.getElementById("objectsCount");
const speedTime = document.getElementById("speedTime");
const viewLogsBtn = document.getElementById("viewLogsBtn");
const viewStatsBtn = document.getElementById("viewStatsBtn");
const clearLogsBtn = document.getElementById("clearLogsBtn");

let isDetecting = false;
let continuousTimer = null;
let confidenceThreshold = 0.10;
const tracker = new ObjectTracker();

const OBJECT_NAMES = [
  "person", "bicycle", "car", "motorbike", "aeroplane", "bus", "train", "truck", "boat",
  "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat", "dog",
  "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack", "umbrella",
  "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball", "kite",
  "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket", "bottle",
  "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
  "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "sofa", "pottedplant",
  "bed", "diningtable", "toilet", "tvmonitor", "laptop", "mouse", "remote", "keyboard",
  "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator", "book", "clock",
  "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
];

const HOUSEHOLD_STUFF = [
  "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl",
  "chair", "sofa", "bed", "toilet", "laptop", "mouse", "remote", "keyboard",
  "cell phone", "microwave", "oven", "toaster", "sink", "refrigerator", "book", "clock",
  "vase", "scissors", "teddy bear", "hair drier", "toothbrush"
];

async function startWebcam() {
  try {
    statusBar.textContent = "Turning on camera...";
    
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      } 
    });
    
    video.srcObject = stream;
    
    await new Promise(done => {
      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        done();
      };
    });
    
    statusBar.textContent = "Camera ready!";
    return true;
    
  } catch (err) {
    console.error("Camera problem:", err);
    statusBar.textContent = `Camera error: ${err.message}`;
    return false;
  }
}

function takePicture() {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = video.videoWidth;
  tempCanvas.height = video.videoHeight;
  const ctx = tempCanvas.getContext("2d");
  ctx.drawImage(video, 0, 0);
  return tempCanvas.toDataURL("image/jpeg", 0.8);
}

async function getAIAnalysis(imageData, detections) {
  try {
    const response = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: imageData,
        detections: detections.map(d => ({
          label: d.detailedName || OBJECT_NAMES[d.classId],
          score: d.score,
          classId: d.classId,
          bbox: { x: d.x, y: d.y, width: d.width, height: d.height }
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`Server said: ${response.status}`);
    }

    return await response.json();
    
  } catch (error) {
    console.error("AI analysis failed:", error);
    return null;
  }
}

function makeDescription(detections) {
  if (detections.length === 0) return "No objects detected";
  
  const people = detections.filter(d => d.classId === 0);
  const objects = detections.filter(d => d.classId !== 0);
  
  let description = "";
  
  // Count people (no gender guessing)
  if (people.length > 0) {
    if (people.length === 1) {
      description += "I see a person";
    } else {
      description += `I see ${people.length} people`;
    }
  }
  
  // Count objects - use detailed names
  const objectCounts = {};
  objects.forEach(d => {
    const name = d.detailedName || OBJECT_NAMES[d.classId];
    objectCounts[name] = (objectCounts[name] || 0) + 1;
  });
  
  if (Object.keys(objectCounts).length > 0) {
    if (description) description += ", and ";
    else description += "I see ";
    
    const objectParts = [];
    Object.entries(objectCounts).forEach(([name, count]) => {
      if (count > 1) {
        objectParts.push(`${count} ${name}s`);
      } else {
        objectParts.push(`a ${name}`);
      }
    });
    
    description += objectParts.join(', ');
  }
  
  return description;
}

function showResults(detections, timeMs, aiData) {
  const numPeople = detections.filter(d => d.classId === 0).length;
  const numObjects = detections.filter(d => d.classId !== 0).length;
  
  peopleCount.textContent = numPeople;
  objectsCount.textContent = numObjects;
  speedTime.textContent = `${timeMs}ms`;
  statsPanel.style.display = 'block';
  
  const naturalDescription = makeDescription(detections);
  
  let html = `
    <div style="background: linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%); padding: 20px; border-radius: 10px; border-left: 4px solid #4f46e5; margin-bottom: 20px;">
      <h3 style="margin-bottom: 10px;">🤖 What I See</h3>
      <p style="font-size: 1.1rem; line-height: 1.6;">${naturalDescription}</p>
    </div>
  `;
  
  if (aiData && aiData.analysis) {
    const analysis = aiData.analysis;
    
    html += `<div style="display: grid; gap: 15px; margin-top: 15px;">`;
    
    if (analysis.spatial) {
      html += `
        <div style="padding: 15px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
          <h4 style="margin-bottom: 8px;">📍 Layout</h4>
          <p style="color: #6b7280;">${analysis.spatial}</p>
        </div>
      `;
    }
    
    if (analysis.context) {
      html += `
        <div style="padding: 15px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
          <h4 style="margin-bottom: 8px;">🎬 What's Happening</h4>
          <p style="color: #6b7280;">${analysis.context}</p>
        </div>
      `;
    }
    
    if (analysis.safety) {
      html += `
        <div style="padding: 15px; background: #fef3c7; border-radius: 8px; border: 1px solid #fbbf24;">
          <h4 style="margin-bottom: 8px; color: #92400e;">⚠️ Safety Note</h4>
          <p style="color: #78350f;">${analysis.safety}</p>
        </div>
      `;
    }
    
    html += `</div>`;
  }
  
  const detectionList = detections
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
    .map(d => {
      const genericName = OBJECT_NAMES[d.classId];
      const specificName = d.detailedName || genericName;
      const confidence = Math.round(d.score * 100);
      const detailedConf = d.detailedConfidence ? ` <span style="color: #10b981;">(${Math.round(d.detailedConfidence * 100)}% match)</span>` : '';
      const generic = specificName !== genericName ? ` <span style="color: #9ca3af; font-size: 0.9rem;">[${genericName}]</span>` : '';
      return `<li><strong>${specificName}</strong> ${confidence}%${detailedConf}${generic}</li>`;
    })
    .join('');
  
  if (detectionList) {
    html += `
      <details open style="margin-top: 15px; padding: 15px; background: white; border-radius: 8px;">
        <summary style="cursor: pointer; font-weight: 600;">📋 All ${detections.length} Detections</summary>
        <ul style="margin-top: 10px; padding-left: 20px; line-height: 1.8;">${detectionList}</ul>
      </details>
    `;
  }
  
  if (aiData) {
    html += `
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 0.875rem; color: #6b7280;">
        <small>Log: ${aiData.logId} • ${new Date().toLocaleTimeString()}</small>
      </div>
    `;
  }
  
  resultsArea.innerHTML = html;
  return naturalDescription;
}

async function runDetection(useAI = false) {
  if (isDetecting) return;
  
  isDetecting = true;
  detectBtn.disabled = true;
  const startTime = performance.now();
  
  try {
    if (voiceToggle.checked) {
      speak("Detecting");
    }
    
    statusBar.textContent = "🔍 Detecting...";
    
    const rawDetections = await detectFrame(video, canvas, confidenceThreshold);
    const detections = tracker.update(rawDetections);
    
    // Smart detailed classification
    const detailedMode = document.getElementById('detailedMode');
    if (detailedMode && detailedMode.checked && detections.length > 0) {
      statusBar.textContent = "🔬 Smart identification...";
      
      const toClassify = detections.filter(d => 
        (!d.detailedName || d.age <= 2) && 
        (!d.detailedConfidence || d.detailedConfidence < 0.6)
      );
      
      for (let i = 0; i < Math.min(toClassify.length, 5); i++) {
        const det = toClassify[i];
        const cocoLabel = OBJECT_NAMES[det.classId];
        
        // Use smart classifier with context
        const result = await classifySmart(video, det, cocoLabel, detections);
        
        if (result && result.contextScore > 0.15) {
          det.detailedName = result.label;
          det.detailedConfidence = result.confidence;
          
          console.log(`Smart ID: ${cocoLabel} -> ${result.label} (${Math.round(result.confidence * 100)}%, context: ${result.contextScore.toFixed(2)})`);
        } else {
          console.log(`Keeping generic: ${cocoLabel}`);
        }
      }
    }
    
    const timeMs = Math.round(performance.now() - startTime);
    
    if (detections.length === 0) {
      statusBar.textContent = "Nothing found";
      resultsArea.innerHTML = `
        <div style="padding: 20px; text-align: center; background: #f3f4f6; border-radius: 8px;">
          <p>No objects detected. Try adjusting lighting or lowering confidence threshold.</p>
        </div>
      `;
      
      if (voiceToggle.checked) {
        speak("No objects detected");
      }
      
      statsPanel.style.display = 'none';
      
    } else {
      let aiData = null;
      
      if (useAI) {
        statusBar.textContent = "Getting AI analysis...";
        const imageData = takePicture();
        aiData = await getAIAnalysis(imageData, detections);
      }
      
      const description = showResults(detections, timeMs, aiData);
      statusBar.textContent = `Found ${detections.length} object${detections.length > 1 ? 's' : ''}`;
      
      if (voiceToggle.checked) {
        speak(description);
      }
    }
    
  } catch (err) {
    console.error("Detection failed:", err);
    statusBar.textContent = "Detection failed";
    resultsArea.innerHTML = `
      <div style="padding: 20px; background: #fee2e2; border-radius: 8px; color: #991b1b;">
        <p><strong>Error:</strong> ${err.message}</p>
      </div>
    `;
    
    if (voiceToggle.checked) {
      speak("Detection failed");
    }
    
  } finally {
    isDetecting = false;
    if (!continuousToggle.checked) {
      detectBtn.disabled = false;
    }
  }
}

async function startup() {
  const cameraOK = await startWebcam();
  if (!cameraOK) return;
  
  try {
    statusBar.textContent = "📦 Loading AI models...";
    
    await initYoloModel();
    const classifierLoaded = await initSmartClassifier();
    
    if (classifierLoaded) {
      statusBar.textContent = "✅ Ready! Smart detection with context awareness";
    } else {
      statusBar.textContent = "✅ Ready! Basic detection mode";
    }
    
    detectBtn.innerHTML = '<span class="icon">📷</span><span class="text">Detect Objects</span>';
    detectBtn.disabled = false;
    
  } catch (err) {
    console.error("Model loading failed:", err);
    statusBar.textContent = `Failed: ${err.message}`;
    resultsArea.innerHTML = `
      <div style="padding: 20px; background: #fee2e2; border-radius: 8px; color: #991b1b;">
        <p><strong>Model Loading Failed</strong></p>
        <p>${err.message}</p>
      </div>
    `;
  }
}

detectBtn.addEventListener("click", () => runDetection(true));

confSlider.addEventListener("input", (e) => {
  const value = parseInt(e.target.value);
  confidenceThreshold = value / 100;
  confValue.textContent = `${value}%`;
});

speedSlider.addEventListener("input", (e) => {
  const value = parseFloat(e.target.value);
  setSpeechRate(value);
  speedValue.textContent = `${value}x`;
});

continuousToggle.addEventListener("change", (e) => {
  if (e.target.checked) {
    detectBtn.innerHTML = '<span class="icon">⏸️</span><span class="text">Pause</span>';
    detectBtn.disabled = false;
    tracker.reset();
    
    continuousTimer = setInterval(() => {
      if (!isDetecting) {
        runDetection(false);
      }
    }, 2000);
    
  } else {
    detectBtn.innerHTML = '<span class="icon">📷</span><span class="text">Detect Objects</span>';
    tracker.reset();
    
    if (continuousTimer) {
      clearInterval(continuousTimer);
      continuousTimer = null;
    }
  }
});

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !detectBtn.disabled && !e.ctrlKey) {
    e.preventDefault();
    detectBtn.click();
  } else if (e.code === "Space" && e.ctrlKey) {
    e.preventDefault();
    continuousToggle.checked = !continuousToggle.checked;
    continuousToggle.dispatchEvent(new Event('change'));
  }
});

viewLogsBtn.addEventListener("click", async () => {
  try {
    const response = await fetch("/api/explain/logs?limit=20");
    const data = await response.json();
    
    if (data.success && data.logs.length > 0) {
      let html = `
        <div style="background: #e0e7ff; padding: 20px; border-radius: 10px; margin-bottom: 15px;">
          <h3>📋 Recent Logs</h3>
        </div>
      `;
      
      data.logs.forEach(log => {
        const date = new Date(log.timestamp).toLocaleString();
        html += `
          <div style="padding: 15px; background: white; border-radius: 8px; margin-bottom: 10px; border: 1px solid #e5e7eb;">
            <strong>${date}</strong>
            <p>${log.description}</p>
            <small style="color: #6b7280;">${log.detections?.length || 0} objects</small>
          </div>
        `;
      });
      
      resultsArea.innerHTML = html;
      statusBar.textContent = "Viewing logs";
      
    } else {
      resultsArea.innerHTML = `
        <div style="padding: 20px; text-align: center; background: #f3f4f6; border-radius: 8px;">
          <p>No logs yet</p>
        </div>
      `;
    }
  } catch (error) {
    console.error("Couldn't load logs:", error);
    resultsArea.innerHTML = `
      <div style="padding: 20px; background: #fee2e2; border-radius: 8px; color: #991b1b;">
        <p>Failed to load logs</p>
      </div>
    `;
  }
});

viewStatsBtn.addEventListener("click", async () => {
  try {
    const response = await fetch("/api/explain/stats");
    const data = await response.json();
    
    if (data.success) {
      const stats = data.stats;
      let html = `
        <div style="background: #e0e7ff; padding: 20px; border-radius: 10px; margin-bottom: 15px;">
          <h3>📊 Statistics</h3>
          <p><strong>Sessions:</strong> ${stats.totalSessions}</p>
          <p><strong>Detections:</strong> ${stats.totalDetections}</p>
        </div>
        <div style="padding: 15px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
          <h4>🏆 Top Objects</h4>
      `;
      
      stats.topObjects.forEach((obj, i) => {
        html += `<p>${i + 1}. ${obj.label}: ${obj.count}x</p>`;
      });
      
      html += `</div>`;
      
      resultsArea.innerHTML = html;
      statusBar.textContent = "Statistics";
    }
  } catch (error) {
    console.error("Stats error:", error);
    resultsArea.innerHTML = `
      <div style="padding: 20px; background: #fee2e2; border-radius: 8px; color: #991b1b;">
        <p>Failed to load stats</p>
      </div>
    `;
  }
});

clearLogsBtn.addEventListener("click", async () => {
  if (confirm("Clear all logs?")) {
    try {
      await fetch("/api/explain/logs", { method: "DELETE" });
      resultsArea.innerHTML = `
        <div style="padding: 20px; background: #dbeafe; border-radius: 8px; text-align: center;">
          <p>✅ Logs cleared</p>
        </div>
      `;
      statusBar.textContent = "Logs cleared";
    } catch (error) {
      resultsArea.innerHTML = `
        <div style="padding: 20px; background: #fee2e2; border-radius: 8px; color: #991b1b;">
          <p>Failed to clear logs</p>
        </div>
      `;
    }
  }
});

startup();
