// Universal object detector using CLIP - can identify literally anything
let clipModel = null;

export async function initUniversalDetector() {
  try {
    console.log("Loading universal detector (CLIP)...");
    
    // Use transformers.js for CLIP
    const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.0');
    
    clipModel = await pipeline('zero-shot-image-classification', 
      'Xenova/clip-vit-base-patch32');
    
    console.log("✓ Universal detector loaded - can identify anything!");
    return true;
  } catch (error) {
    console.error("Universal detector failed:", error);
    return false;
  }
}

// Get comprehensive list of possible objects for any category
function getPossibleLabels(cocoLabel) {
  const labelDatabase = {
    "person": ["man", "woman", "boy", "girl", "child", "adult", "person", "human"],
    "bottle": ["water bottle", "plastic bottle", "glass bottle", "wine bottle", "beer bottle", "soda bottle"],
    "cup": ["coffee cup", "tea cup", "mug", "paper cup", "glass", "drinking glass"],
    "cell phone": ["smartphone", "iPhone", "Android phone", "mobile phone", "cell phone"],
    "laptop": ["laptop computer", "MacBook", "notebook computer", "gaming laptop"],
    "mouse": ["computer mouse", "wireless mouse", "gaming mouse"],
    "keyboard": ["computer keyboard", "mechanical keyboard", "wireless keyboard"],
    "book": ["textbook", "notebook", "novel", "hardcover book", "paperback book", "journal"],
    "clock": ["wall clock", "alarm clock", "digital clock", "analog clock"],
    "backpack": ["backpack", "rucksack", "school bag", "hiking backpack"],
    "handbag": ["purse", "handbag", "shoulder bag", "tote bag", "clutch"],
    "chair": ["office chair", "dining chair", "armchair", "folding chair", "gaming chair"],
    "couch": ["sofa", "couch", "sectional", "loveseat"],
    "bed": ["bed", "queen bed", "twin bed", "bunk bed"],
    "dining table": ["dining table", "kitchen table", "wooden table", "glass table"],
    "toilet": ["toilet", "bathroom toilet", "commode"],
    "tv": ["television", "flat screen TV", "smart TV", "LED TV", "monitor"],
    "remote": ["TV remote", "remote control", "universal remote"],
    "microwave": ["microwave oven", "microwave"],
    "oven": ["oven", "stove", "electric oven", "gas oven"],
    "toaster": ["toaster", "toaster oven"],
    "sink": ["kitchen sink", "bathroom sink", "wash basin"],
    "refrigerator": ["refrigerator", "fridge", "freezer"],
    "bowl": ["bowl", "mixing bowl", "cereal bowl", "soup bowl"],
    "banana": ["banana", "ripe banana", "green banana"],
    "apple": ["apple", "red apple", "green apple", "Granny Smith apple"],
    "sandwich": ["sandwich", "sub sandwich", "panini", "burger"],
    "orange": ["orange", "mandarin", "tangerine", "clementine"],
    "broccoli": ["broccoli", "broccoli florets"],
    "carrot": ["carrot", "baby carrot"],
    "pizza": ["pizza", "pizza slice", "pepperoni pizza"],
    "donut": ["donut", "doughnut", "glazed donut"],
    "cake": ["cake", "birthday cake", "chocolate cake", "cupcake"],
    "potted plant": ["potted plant", "houseplant", "indoor plant", "succulent", "cactus"],
    "vase": ["vase", "flower vase", "decorative vase"],
    "scissors": ["scissors", "craft scissors", "kitchen scissors"],
    "teddy bear": ["teddy bear", "stuffed animal", "plush toy"],
    "hair drier": ["hair dryer", "blow dryer"],
    "toothbrush": ["toothbrush", "electric toothbrush"],
    "sports ball": ["soccer ball", "basketball", "football", "tennis ball", "baseball"],
    "frisbee": ["frisbee", "flying disc"],
    "kite": ["kite"],
    "baseball bat": ["baseball bat", "wooden bat", "aluminum bat"],
    "skateboard": ["skateboard", "longboard"],
    "surfboard": ["surfboard"],
    "tennis racket": ["tennis racket"],
    "wine glass": ["wine glass", "stemware"],
    "fork": ["fork", "dinner fork"],
    "knife": ["knife", "butter knife", "steak knife"],
    "spoon": ["spoon", "tablespoon", "teaspoon"],
    "hot dog": ["hot dog", "frankfurter"],
    "suitcase": ["suitcase", "luggage", "travel bag", "carry-on"],
    "umbrella": ["umbrella", "rain umbrella", "parasol"],
    "tie": ["necktie", "tie", "bow tie"],
    "bicycle": ["bicycle", "bike", "mountain bike", "road bike"],
    "car": ["car", "sedan", "SUV", "vehicle", "automobile"],
    "motorcycle": ["motorcycle", "motorbike", "scooter"],
    "bus": ["bus", "school bus", "city bus"],
    "train": ["train", "passenger train", "subway"],
    "truck": ["truck", "pickup truck", "delivery truck"],
    "boat": ["boat", "sailboat", "motorboat"],
    "traffic light": ["traffic light", "stoplight"],
    "fire hydrant": ["fire hydrant"],
    "stop sign": ["stop sign"],
    "parking meter": ["parking meter"],
    "bench": ["bench", "park bench", "wooden bench"],
    "bird": ["bird", "sparrow", "pigeon", "crow", "robin"],
    "cat": ["cat", "kitten", "tabby cat", "domestic cat"],
    "dog": ["dog", "puppy", "golden retriever", "labrador", "poodle"],
    "horse": ["horse", "stallion", "mare"],
    "sheep": ["sheep", "lamb"],
    "cow": ["cow", "cattle", "bull"],
    "elephant": ["elephant"],
    "bear": ["bear", "teddy bear", "grizzly bear"],
    "zebra": ["zebra"],
    "giraffe": ["giraffe"]
  };
  
  // Default comprehensive list if not in database
  return labelDatabase[cocoLabel] || [
    cocoLabel, 
    `${cocoLabel} object`,
    `small ${cocoLabel}`,
    `large ${cocoLabel}`,
    `modern ${cocoLabel}`,
    `vintage ${cocoLabel}`
  ];
}

// Identify any object using CLIP
export async function identifyUniversal(video, box, cocoLabel) {
  if (!clipModel) return null;
  
  try {
    // Create canvas for the detected region
    const canvas = document.createElement('canvas');
    const size = 224;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Draw the cropped region
    ctx.drawImage(
      video,
      box.x, box.y, box.width, box.height,
      0, 0, size, size
    );
    
    // Get possible labels for this category
    const candidateLabels = getPossibleLabels(cocoLabel);
    
    // Classify with CLIP
    const imageDataURL = canvas.toDataURL('image/jpeg', 0.9);
    const result = await clipModel(imageDataURL, candidateLabels);
    
    // Return best match
    if (result && result.length > 0) {
      return {
        label: result[0].label,
        confidence: result[0].score
      };
    }
    
    return null;
    
  } catch (error) {
    console.error("Universal detection error:", error);
    return null;
  }
}
