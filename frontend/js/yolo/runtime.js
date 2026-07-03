import { decodeYolo, drawDetections } from "./decode.js";

let yoloSession = null;
const MODEL_SIZE = 640;

export async function initYoloModel() {
  try {
    console.log("Checking ONNX Runtime...");
    
    if (typeof ort === 'undefined') {
      throw new Error("ONNX Runtime not loaded");
    }
    
    console.log("ONNX Runtime version:", ort.env.versions);
    console.log("Loading YOLO model with optimizations...");
    
    yoloSession = await ort.InferenceSession.create("models/yolov8n.onnx", {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
      enableCpuMemArena: true,
      enableMemPattern: true,
      executionMode: 'parallel'
    });
    
    console.log("✓ Model loaded!");
    console.log("  Inputs:", yoloSession.inputNames);
    console.log("  Outputs:", yoloSession.outputNames);
    
    return true;
    
  } catch (error) {
    console.error("Model loading failed:", error);
    throw new Error(`Model loading failed: ${error.message || error.toString()}`);
  }
}

// Advanced image enhancement for better detection
function enhanceImageForDetection(imageData) {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  // Step 1: Calculate histogram for auto-levels
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
    histogram[Math.floor(brightness)]++;
  }
  
  // Find 2% and 98% percentiles (ignore extreme darks/lights)
  const totalPixels = width * height;
  const lowPercentile = totalPixels * 0.02;
  const highPercentile = totalPixels * 0.98;
  
  let sum = 0;
  let minLevel = 0;
  for (let i = 0; i < 256; i++) {
    sum += histogram[i];
    if (sum > lowPercentile) {
      minLevel = i;
      break;
    }
  }
  
  sum = 0;
  let maxLevel = 255;
  for (let i = 255; i >= 0; i--) {
    sum += histogram[i];
    if (sum > (totalPixels - highPercentile)) {
      maxLevel = i;
      break;
    }
  }
  
  // Step 2: Apply auto-levels stretch
  const range = Math.max(1, maxLevel - minLevel);
  const scale = 255 / range;
  
  for (let i = 0; i < data.length; i += 4) {
    // RGB channels
    for (let c = 0; c < 3; c++) {
      let value = data[i + c];
      value = (value - minLevel) * scale;
      data[i + c] = Math.min(255, Math.max(0, value));
    }
  }
  
  // Step 3: Adaptive sharpening (only on edges)
  const tempData = new Uint8ClampedArray(data);
  const sharpenStrength = 0.3;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        const idx = (y * width + x) * 4 + c;
        
        // Laplacian filter for edge detection
        const center = tempData[idx];
        const top = tempData[((y-1) * width + x) * 4 + c];
        const bottom = tempData[((y+1) * width + x) * 4 + c];
        const left = tempData[(y * width + (x-1)) * 4 + c];
        const right = tempData[(y * width + (x+1)) * 4 + c];
        
        const edge = center * 5 - top - bottom - left - right;
        const sharpened = center + edge * sharpenStrength;
        
        data[idx] = Math.min(255, Math.max(0, sharpened));
      }
    }
  }
}

function prepareImage(video) {
  const canvas = document.createElement("canvas");
  canvas.width = MODEL_SIZE;
  canvas.height = MODEL_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  
  const scale = Math.min(MODEL_SIZE / video.videoWidth, MODEL_SIZE / video.videoHeight);
  const scaledW = video.videoWidth * scale;
  const scaledH = video.videoHeight * scale;
  const offsetX = (MODEL_SIZE - scaledW) / 2;
  const offsetY = (MODEL_SIZE - scaledH) / 2;
  
  // Gray background for letterboxing
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, MODEL_SIZE, MODEL_SIZE);
  
  // Draw video
  ctx.drawImage(video, offsetX, offsetY, scaledW, scaledH);
  
  // Get image data and enhance it
  let imageData = ctx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE);
  enhanceImageForDetection(imageData);
  ctx.putImageData(imageData, 0, 0);
  
  // Get final enhanced image
  imageData = ctx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE);
  
  // Convert to tensor format optimized
  const input = new Float32Array(3 * MODEL_SIZE * MODEL_SIZE);
  const pixelCount = MODEL_SIZE * MODEL_SIZE;
  
  // Optimized conversion loop
  for (let i = 0; i < pixelCount; i++) {
    const pixelIndex = i * 4;
    input[i] = imageData.data[pixelIndex] / 255.0;
    input[pixelCount + i] = imageData.data[pixelIndex + 1] / 255.0;
    input[2 * pixelCount + i] = imageData.data[pixelIndex + 2] / 255.0;
  }
  
  return { input, scale, offsetX, offsetY };
}

export async function detectFrame(video, canvas, minConfidence = 0.25) {
  if (!yoloSession) {
    throw new Error("Model not loaded");
  }
  
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("Video not ready");
  }
  
  try {
    const { input, scale, offsetX, offsetY } = prepareImage(video);
    
    const tensor = new ort.Tensor("float32", input, [1, 3, MODEL_SIZE, MODEL_SIZE]);
    
    const feeds = { images: tensor };
    
    const startTime = performance.now();
    const results = await yoloSession.run(feeds);
    const inferenceTime = performance.now() - startTime;
    
    console.log(`Inference: ${inferenceTime.toFixed(2)}ms`);
    
    const output = results.output0 || results[yoloSession.outputNames[0]];
    const outputData = output.data;
    const outputShape = output.dims;
    
    const detections = decodeYolo(
      outputData, 
      outputShape,
      video.videoWidth, 
      video.videoHeight,
      MODEL_SIZE,
      scale,
      offsetX,
      offsetY,
      minConfidence
    );
    
    console.log(`Found ${detections.length} objects`);
    
    if (canvas) {
      drawDetections(canvas, video, detections);
    }
    
    return detections;
    
  } catch (error) {
    console.error("Detection error:", error);
    throw error;
  }
}
