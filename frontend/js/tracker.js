// Object tracking for smooth, stable detections over time
class ObjectTracker {
  constructor() {
    this.tracks = [];
    this.nextId = 0;
    this.maxAge = 5; // Frames before removing track
  }
  
  update(detections) {
    const matched = new Set();
    const currentTracks = [];
    
    // Match new detections to existing tracks
    for (const track of this.tracks) {
      let bestMatch = null;
      let bestIoU = 0;
      
      for (let i = 0; i < detections.length; i++) {
        if (matched.has(i)) continue;
        if (track.classId !== detections[i].classId) continue;
        
        const iou = this.calculateIoU(track, detections[i]);
        if (iou > bestIoU && iou > 0.3) {
          bestIoU = iou;
          bestMatch = i;
        }
      }
      
      if (bestMatch !== null) {
        // Update track with smoothing
        const det = detections[bestMatch];
        const alpha = 0.7; // Smoothing factor
        
        track.x = alpha * det.x + (1 - alpha) * track.x;
        track.y = alpha * det.y + (1 - alpha) * track.y;
        track.width = alpha * det.width + (1 - alpha) * track.width;
        track.height = alpha * det.height + (1 - alpha) * track.height;
        track.x2 = track.x + track.width;
        track.y2 = track.y + track.height;
        track.score = Math.max(track.score, det.score);
        track.age++;
        track.misses = 0;
        track.detailedName = det.detailedName || track.detailedName;
        track.detailedConfidence = det.detailedConfidence || track.detailedConfidence;
        
        currentTracks.push(track);
        matched.add(bestMatch);
      } else {
        // Track lost
        track.misses++;
        if (track.misses < this.maxAge) {
          currentTracks.push(track);
        }
      }
    }
    
    // Create new tracks for unmatched detections
    for (let i = 0; i < detections.length; i++) {
      if (!matched.has(i)) {
        const det = detections[i];
        currentTracks.push({
          id: this.nextId++,
          classId: det.classId,
          x: det.x,
          y: det.y,
          width: det.width,
          height: det.height,
          x2: det.x2,
          y2: det.y2,
          score: det.score,
          age: 1,
          misses: 0,
          detailedName: det.detailedName,
          detailedConfidence: det.detailedConfidence
        });
      }
    }
    
    this.tracks = currentTracks;
    
    // Return only stable tracks (seen multiple times)
    return this.tracks.filter(t => t.age >= 2);
  }
  
  calculateIoU(box1, box2) {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x2 || (box1.x + box1.width), box2.x2 || (box2.x + box2.width));
    const y2 = Math.min(box1.y2 || (box1.y + box1.height), box2.y2 || (box2.y + box2.height));
    
    const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const area1 = box1.width * box1.height;
    const area2 = box2.width * box2.height;
    const union = area1 + area2 - intersection;
    
    return intersection / union;
  }
  
  reset() {
    this.tracks = [];
  }
}

export { ObjectTracker };
