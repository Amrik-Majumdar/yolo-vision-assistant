let mobileNetModel = null;

// Load MobileNet for detailed classification (1000 ImageNet classes)
export async function initClassifier() {
  try {
    console.log("Loading MobileNet classifier...");
    mobileNetModel = await mobilenet.load();
    console.log("✓ MobileNet loaded (1000+ object classes)");
    return true;
  } catch (error) {
    console.error("MobileNet loading failed:", error);
    return false;
  }
}

// Classify a specific region of the video
export async function classifyRegion(video, box) {
  if (!mobileNetModel) {
    return null;
  }
  
  try {
    // Create canvas for the cropped region
    const canvas = document.createElement('canvas');
    const size = 224; // MobileNet input size
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Draw the detected region
    ctx.drawImage(
      video,
      box.x, box.y, box.width, box.height,  // Source region
      0, 0, size, size  // Destination (resized to 224x224)
    );
    
    // Classify this region
    const predictions = await mobileNetModel.classify(canvas, 3); // Top 3 predictions
    
    return predictions;
    
  } catch (error) {
    console.error("Classification error:", error);
    return null;
  }
}

// Clean up class names (remove technical terms)
export function cleanClassName(name) {
  // Remove technical suffixes like "_1", "n12345"
  name = name.replace(/_\d+$/, '');
  name = name.replace(/^n\d+\s+/, '');
  
  // Split on comma and take first part
  name = name.split(',')[0];
  
  // Remove parentheses content
  name = name.replace(/\([^)]*\)/g, '').trim();
  
  // Capitalize properly
  name = name.toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  return name;
}
