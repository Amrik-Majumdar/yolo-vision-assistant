export function decodeYolo(
  rawOutput, 
  outputShape,
  imageWidth, 
  imageHeight,
  modelSize = 640,
  scale = 1,
  offsetX = 0,
  offsetY = 0,
  minConfidence = 0.25,
  iouThreshold = 0.5
) {
  const allBoxes = [];
  const NUM_CLASSES = 80;
  
  console.log("Decoding output shape:", outputShape);
  
  let batchSize, numPredictions, numFeatures;
  
  if (outputShape.length === 3) {
    [batchSize, numFeatures, numPredictions] = outputShape;
    
    if (numFeatures > numPredictions) {
      [batchSize, numPredictions, numFeatures] = outputShape;
      console.log("Transposed format detected");
    }
  } else {
    console.error("Unexpected output shape");
    return [];
  }
  
  console.log(`Processing ${numPredictions} predictions`);
  
  // Much more aggressive adaptive thresholds
  const adaptiveThresholds = getAggressiveAdaptiveThresholds(minConfidence);
  
  for (let i = 0; i < numPredictions; i++) {
    let centerX, centerY, boxW, boxH;
    
    if (numFeatures === 84) {
      centerX = rawOutput[i];
      centerY = rawOutput[numPredictions + i];
      boxW = rawOutput[2 * numPredictions + i];
      boxH = rawOutput[3 * numPredictions + i];
    } else {
      const baseIdx = i * numFeatures;
      centerX = rawOutput[baseIdx];
      centerY = rawOutput[baseIdx + 1];
      boxW = rawOutput[baseIdx + 2];
      boxH = rawOutput[baseIdx + 3];
    }
    
    const classScores = [];
    for (let c = 0; c < NUM_CLASSES; c++) {
      if (numFeatures === 84) {
        classScores.push(rawOutput[(4 + c) * numPredictions + i]);
      } else {
        classScores.push(rawOutput[i * numFeatures + 4 + c]);
      }
    }
    
    const maxScore = Math.max(...classScores);
    const bestClass = classScores.indexOf(maxScore);
    
    // Use much lower adaptive threshold
    if (maxScore < adaptiveThresholds[bestClass]) continue;
    
    const x1 = centerX - boxW / 2;
    const y1 = centerY - boxH / 2;
    const x2 = centerX + boxW / 2;
    const y2 = centerY + boxH / 2;
    
    const imgX1 = (x1 - offsetX) / scale;
    const imgY1 = (y1 - offsetY) / scale;
    const imgX2 = (x2 - offsetX) / scale;
    const imgY2 = (y2 - offsetY) / scale;
    
    const clampedX1 = Math.max(0, Math.min(imageWidth, imgX1));
    const clampedY1 = Math.max(0, Math.min(imageHeight, imgY1));
    const clampedX2 = Math.max(0, Math.min(imageWidth, imgX2));
    const clampedY2 = Math.max(0, Math.min(imageHeight, imgY2));
    
    const width = clampedX2 - clampedX1;
    const height = clampedY2 - clampedY1;
    
    // Only filter out VERY tiny boxes
    if (width < 5 || height < 5) continue;
    
    allBoxes.push({
      classId: bestClass,
      score: maxScore,
      x: clampedX1,
      y: clampedY1,
      width: width,
      height: height,
      x2: clampedX2,
      y2: clampedY2
    });
  }
  
  console.log(`Raw detections: ${allBoxes.length}`);
  
  // Use gentler NMS to keep more valid detections
  const finalBoxes = gentleNMS(allBoxes, iouThreshold);
  
  console.log(`After NMS: ${finalBoxes.length}`);
  
  return finalBoxes;
}

// Much more aggressive lower thresholds for better recall
function getAggressiveAdaptiveThresholds(baseThreshold) {
  const thresholds = new Array(80).fill(baseThreshold);
  
  // VERY low thresholds for important everyday objects
  const veryImportant = [
    0,  // person - MOST IMPORTANT
    39, 40, 41, 42, 43, 44, 45, // bottles, cups, utensils
    56, 57, 59, // chair, couch, bed
    62, 63, 64, 65, 66, 67, // electronics
    73, 74, 75, 76, 77, 78, 79, // books, clocks, vases, scissors, bears, dryers, brushes
    24, 25, 26, 27, 28 // bags, ties, suitcases, frisbees
  ];
  
  // Lower threshold for all common items
  const common = [
    1, 2, 3, 5, 7, // vehicles
    11, 13, // signs, benches
    15, 16, 17, // animals
    46, 47, 48, 49, 50, 51, 52, 53, 54, 55, // food
    58, 60, 61, // potted plants, tables, toilets
    68, 69, 70, 71, 72 // appliances
  ];
  
  // VERY IMPORTANT: Much lower thresholds
  veryImportant.forEach(classId => {
    thresholds[classId] = baseThreshold * 0.5; // 50% of base (very aggressive)
  });
  
  // COMMON: Somewhat lower
  common.forEach(classId => {
    thresholds[classId] = baseThreshold * 0.7; // 70% of base
  });
  
  return thresholds;
}

// Gentler NMS that keeps more valid detections
function gentleNMS(boxes, iouThreshold) {
  boxes.sort((a, b) => b.score - a.score);
  
  const keep = [];
  const removed = new Set();
  
  for (let i = 0; i < boxes.length; i++) {
    if (removed.has(i)) continue;
    
    const boxA = boxes[i];
    keep.push(boxA);
    
    // Only suppress boxes that are VERY similar
    for (let j = i + 1; j < boxes.length; j++) {
      if (removed.has(j)) continue;
      
      const boxB = boxes[j];
      
      // Only compare same class
      if (boxA.classId !== boxB.classId) continue;
      
      const iou = calculateOverlap(boxA, boxB);
      
      // Much higher threshold - only remove if VERY overlapping
      if (iou > iouThreshold + 0.2) {
        removed.add(j);
      } else if (iou > iouThreshold) {
        // Partial overlap: reduce confidence slightly instead of removing
        boxB.score *= (1 - iou * 0.5);
      }
    }
    
    // Limit total detections for performance
    if (keep.length >= 50) break;
  }
  
  return keep;
}

function calculateOverlap(boxA, boxB) {
  const x1 = Math.max(boxA.x, boxB.x);
  const y1 = Math.max(boxA.y, boxB.y);
  const x2 = Math.min(boxA.x2, boxB.x2);
  const y2 = Math.min(boxA.y2, boxB.y2);
  
  const overlapArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = boxA.width * boxA.height;
  const areaB = boxB.width * boxB.height;
  const totalArea = areaA + areaB - overlapArea;
  
  return overlapArea / totalArea;
}

export function drawDetections(canvas, video, detections) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
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
  
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  
  detections.forEach((det) => {
    const color = `hsl(${(det.classId * 137) % 360}, 70%, 50%)`;
    
    // Draw box with glow effect
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(det.x, det.y, det.width, det.height);
    ctx.shadowBlur = 0;
    
    // Draw label
    const name = OBJECT_NAMES[det.classId];
    const confidence = Math.round(det.score * 100);
    const label = `${name} ${confidence}%`;
    
    ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI'";
    const textWidth = ctx.measureText(label).width;
    
    ctx.fillStyle = color;
    ctx.fillRect(det.x, det.y - 25, textWidth + 10, 25);
    
    ctx.fillStyle = "white";
    ctx.fillText(label, det.x + 5, det.y - 7);
  });
}
