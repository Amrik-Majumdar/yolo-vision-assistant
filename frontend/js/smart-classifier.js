let mobileNetModel = null;
let detectionHistory = {};

export async function initSmartClassifier() {
  try {
    console.log("Loading smart classifier...");
    mobileNetModel = await mobilenet.load();
    console.log("✓ Smart classifier loaded");
    return true;
  } catch (error) {
    console.error("Smart classifier failed:", error);
    return false;
  }
}

// Comprehensive object database with common names
const OBJECT_REFINEMENTS = {
  "book": {
    keywords: ["book", "notebook", "textbook", "novel", "magazine", "paper", "document", "folder", "binder"],
    commonItems: ["notebook", "paper", "document", "magazine", "book"],
    rareItems: ["encyclopedia", "dictionary", "atlas"],
    relatedTo: ["desk", "table", "person"]
  },
  "bottle": {
    keywords: ["bottle", "water bottle", "plastic bottle", "flask", "container"],
    commonItems: ["water bottle", "plastic bottle", "drink bottle"],
    rareItems: ["wine bottle", "medicine bottle"],
    relatedTo: ["person", "table", "desk"]
  },
  "cup": {
    keywords: ["cup", "mug", "glass", "tumbler", "coffee cup", "tea cup"],
    commonItems: ["coffee cup", "mug", "glass", "water glass"],
    rareItems: ["wine glass", "champagne glass"],
    relatedTo: ["person", "table", "desk"]
  },
  "cell phone": {
    keywords: ["phone", "smartphone", "mobile", "iPhone", "Android", "cell phone"],
    commonItems: ["smartphone", "cell phone", "iPhone"],
    rareItems: ["flip phone", "landline"],
    relatedTo: ["person", "desk", "table"]
  },
  "laptop": {
    keywords: ["laptop", "computer", "notebook", "MacBook", "PC"],
    commonItems: ["laptop", "notebook computer"],
    rareItems: ["gaming laptop", "ultrabook"],
    relatedTo: ["desk", "table", "person"]
  },
  "person": {
    keywords: ["person", "man", "woman", "human", "people"],
    commonItems: ["person"],
    rareItems: [],
    relatedTo: []
  },
  "chair": {
    keywords: ["chair", "seat", "stool", "bench"],
    commonItems: ["chair", "office chair", "desk chair"],
    rareItems: ["throne", "rocking chair"],
    relatedTo: ["desk", "table"]
  },
  "backpack": {
    keywords: ["backpack", "bag", "rucksack", "school bag", "bookbag"],
    commonItems: ["backpack", "school bag"],
    rareItems: ["hiking backpack", "military pack"],
    relatedTo: ["person"]
  },
  "handbag": {
    keywords: ["purse", "handbag", "bag", "tote", "shoulder bag"],
    commonItems: ["purse", "handbag", "tote bag"],
    rareItems: ["clutch", "evening bag"],
    relatedTo: ["person"]
  },
  "keyboard": {
    keywords: ["keyboard", "computer keyboard", "mechanical keyboard"],
    commonItems: ["keyboard", "computer keyboard"],
    rareItems: ["gaming keyboard", "piano keyboard"],
    relatedTo: ["laptop", "desk", "mouse"]
  },
  "mouse": {
    keywords: ["mouse", "computer mouse", "wireless mouse"],
    commonItems: ["mouse", "computer mouse"],
    rareItems: ["gaming mouse", "trackball"],
    relatedTo: ["laptop", "keyboard", "desk"]
  },
  "remote": {
    keywords: ["remote", "remote control", "TV remote", "controller"],
    commonItems: ["TV remote", "remote control"],
    rareItems: ["universal remote", "game controller"],
    relatedTo: ["tv"]
  },
  "clock": {
    keywords: ["clock", "watch", "timepiece", "alarm clock"],
    commonItems: ["clock", "wall clock", "alarm clock"],
    rareItems: ["grandfather clock", "cuckoo clock"],
    relatedTo: ["desk", "wall"]
  }
};

// Get likely object based on context
function getContextualLikelihood(cocoLabel, predictions, nearbyObjects) {
  const refinement = OBJECT_REFINEMENTS[cocoLabel];
  if (!refinement) return predictions[0];
  
  // Score each prediction
  const scored = predictions.map(pred => {
    let score = pred.probability;
    const predName = pred.className.toLowerCase();
    
    // Check if prediction matches any keywords
    const matchesKeywords = refinement.keywords.some(kw => 
      predName.includes(kw.toLowerCase())
    );
    
    if (!matchesKeywords) {
      score *= 0.1; // Heavily penalize non-matching
    }
    
    // Boost common items
    const isCommon = refinement.commonItems.some(item => 
      predName.includes(item.toLowerCase())
    );
    if (isCommon) {
      score *= 2.0;
    }
    
    // Penalize rare items unless high confidence
    const isRare = refinement.rareItems.some(item => 
      predName.includes(item.toLowerCase())
    );
    if (isRare && pred.probability < 0.7) {
      score *= 0.3;
    }
    
    // Context boost: if related objects are nearby
    if (nearbyObjects && nearbyObjects.length > 0) {
      const hasRelated = refinement.relatedTo.some(related =>
        nearbyObjects.includes(related)
      );
      if (hasRelated) {
        score *= 1.5;
      }
    }
    
    return { ...pred, contextScore: score };
  });
  
  // Sort by context score
  scored.sort((a, b) => b.contextScore - a.contextScore);
  
  return scored[0];
}

// Smart classification with context awareness
export async function classifySmart(video, box, cocoLabel, allDetections) {
  if (!mobileNetModel) return null;
  
  try {
    // Create canvas for the region with padding
    const canvas = document.createElement('canvas');
    const padding = 0.15; // 15% padding around box
    const paddedWidth = box.width * (1 + padding * 2);
    const paddedHeight = box.height * (1 + padding * 2);
    const paddedX = Math.max(0, box.x - box.width * padding);
    const paddedY = Math.max(0, box.y - box.height * padding);
    
    const size = 224;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Draw with padding for better context
    ctx.drawImage(
      video,
      paddedX, paddedY, paddedWidth, paddedHeight,
      0, 0, size, size
    );
    
    // Get predictions
    const predictions = await mobileNetModel.classify(canvas, 5);
    
    if (!predictions || predictions.length === 0) return null;
    
    // Get nearby objects for context
    const nearbyObjects = allDetections
      .filter(d => {
        const dist = Math.sqrt(
          Math.pow(d.x - box.x, 2) + Math.pow(d.y - box.y, 2)
        );
        return dist < 300; // Within 300 pixels
      })
      .map(d => {
        const COCO_CLASSES = [
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
        return COCO_CLASSES[d.classId];
      });
    
    // Apply contextual intelligence
    const bestMatch = getContextualLikelihood(cocoLabel, predictions, nearbyObjects);
    
    // Track detection history for learning
    if (!detectionHistory[cocoLabel]) {
      detectionHistory[cocoLabel] = {};
    }
    const refinedName = cleanClassName(bestMatch.className);
    detectionHistory[cocoLabel][refinedName] = 
      (detectionHistory[cocoLabel][refinedName] || 0) + 1;
    
    // Only return if confidence is reasonable
    if (bestMatch.contextScore < 0.1) {
      console.log(`Low confidence for ${cocoLabel}, keeping generic name`);
      return null;
    }
    
    return {
      label: cleanClassName(bestMatch.className),
      confidence: bestMatch.probability,
      contextScore: bestMatch.contextScore
    };
    
  } catch (error) {
    console.error("Smart classification error:", error);
    return null;
  }
}

// Enhanced name cleaning
export function cleanClassName(name) {
  // Remove technical IDs
  name = name.replace(/_\d+$/, '');
  name = name.replace(/^n\d+\s+/, '');
  
  // Take first option before comma
  name = name.split(',')[0];
  
  // Remove parentheses
  name = name.replace(/\([^)]*\)/g, '').trim();
  
  // Common replacements for better names
  const replacements = {
    "notebook computer": "laptop",
    "portable computer": "laptop",
    "desktop computer": "computer",
    "cellular telephone": "phone",
    "mobile phone": "phone",
    "ballpoint": "pen",
    "ball-point pen": "pen",
    "fountain pen": "pen",
    "coffee mug": "mug",
    "paper towel": "paper",
    "toilet tissue": "tissue",
    "water bottle": "bottle",
    "plastic bottle": "bottle",
    "drinking glass": "glass"
  };
  
  const lowerName = name.toLowerCase();
  for (const [oldName, newName] of Object.entries(replacements)) {
    if (lowerName === oldName) {
      return newName.charAt(0).toUpperCase() + newName.slice(1);
    }
  }
  
  // Smart capitalization
  const words = name.toLowerCase().split(' ');
  return words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Get most common identification for learning
export function getMostCommonIdentification(cocoLabel) {
  if (!detectionHistory[cocoLabel]) return null;
  
  const items = Object.entries(detectionHistory[cocoLabel]);
  if (items.length === 0) return null;
  
  items.sort((a, b) => b[1] - a[1]);
  return items[0][0];
}
