const aquarium = document.getElementById("aquarium");
const creatureImages = {
  shrimp: {
    gif: "/resources/images/shrimp.gif",
    png: "/resources/images/shrimp.png"
  },
  crab: {
    gif: "/resources/images/crab.gif",
    png: "/resources/images/crab.png"
  },
  octopus: {
    gif: "/resources/images/octopus.gif",
    png: "/resources/images/octopus.png"
  },
  fish: {
    gif: "/resources/images/fish.gif",
    png: "/resources/images/fish.png"
  },
  tuna: {
    gif: "/resources/images/tuna.gif",
    png: "/resources/images/tuna.png"
  },
  dolphin: {
    gif: "/resources/images/dolphin.gif",
    png: "/resources/images/dolphin.png"
  },
  shark: {
    gif: "/resources/images/shark.gif", 
    png: "/resources/images/shark.png"
  },
  whale: {
    gif: "/resources/images/whale.gif",
    png: "/resources/images/whale.png"
  }
};

let paused = false;
let isNightMode = false;
let radarPosition = 0;
let currentCreatures = [];
let draggedCreature = null;
let dragOffset = { x: 0, y: 0 };
let searchBlockHeight = 0; // Will be set to latest block
let activeArrows = []; // Track active arrows for position updates
let selectedCreature = null; // Track creature currently shown in info panel

// Movement functions for each creature type

// Shrimp: Float aimlessly with gentle random movement
function startShrimpMovement(creature) {
  if (!creature || !creature.element || !creature.data) return;
  
  if (creature.interval) clearInterval(creature.interval);
  
  // Random gentle velocities
  creature.vx = (Math.random() - 0.5) * 1.2;
  creature.vy = (Math.random() - 0.5) * 1.2;
  
  creature.interval = setInterval(() => {
    if (!creature.element || !creature.element.parentNode) {
      clearInterval(creature.interval);
      return;
    }
    
    const currentX = parseInt(creature.element.style.left) || 0;
    const currentY = parseInt(creature.element.style.top) || 0;
    
    // Randomly change direction occasionally
    if (Math.random() < 0.08) {
      creature.vx = (Math.random() - 0.5) * 1.2;
      creature.vy = (Math.random() - 0.5) * 1.2;
    }
    
    const newX = currentX + creature.vx;
    const newY = currentY + creature.vy;
    
    // Bounce off boundaries
    if (newX <= creature.minX || newX >= creature.maxX) creature.vx = -creature.vx;
    if (newY <= creature.minY || newY >= creature.maxY) creature.vy = -creature.vy;
    
    const boundedX = Math.max(creature.minX, Math.min(newX, creature.maxX));
    const boundedY = Math.max(creature.minY, Math.min(newY, creature.maxY));
    
    creature.element.style.left = boundedX + "px";
    creature.element.style.top = boundedY + "px";
    creature.x = boundedX;
    creature.y = boundedY;
  }, 60);
}

// Crab: Move back and forth on bottom with gravity
function startCrabMovement(creature) {
  if (!creature || !creature.element || !creature.data) return;
  
  if (creature.interval) clearInterval(creature.interval);
  
  creature.vx = 1;
  creature.vy = 0;
  creature.gravity = 0.5;
  creature.bottomY = creature.maxY; // Always try to get to bottom
  
  creature.interval = setInterval(() => {
    if (!creature.element || !creature.element.parentNode) {
      clearInterval(creature.interval);
      return;
    }
    
    const currentX = parseInt(creature.element.style.left) || 0;
    const currentY = parseInt(creature.element.style.top) || 0;
    
    // Apply gravity - always fall towards bottom
    if (currentY < creature.bottomY) {
      creature.vy += creature.gravity;
    } else {
      creature.vy = 0;
    }
    
    const newX = currentX + creature.vx;
    const newY = currentY + creature.vy;
    
    // Bounce horizontally at boundaries
    if (newX <= creature.minX || newX >= creature.maxX) {
      creature.vx = -creature.vx;
      creature.element.style.transform = creature.vx > 0 ? "none" : "scaleX(-1)";
    }
    
    const boundedX = Math.max(creature.minX, Math.min(newX, creature.maxX));
    const boundedY = Math.max(creature.minY, Math.min(newY, creature.bottomY));
    
    creature.element.style.left = boundedX + "px";
    creature.element.style.top = boundedY + "px";
    creature.x = boundedX;
    creature.y = boundedY;
  }, 50);
}

// Octopus: Move vertically from bottom to middle, no horizontal movement
function startOctopusMovement(creature) {
  if (!creature || !creature.element || !creature.data) return;
  
  if (creature.interval) clearInterval(creature.interval);
  
  creature.vx = 0;
  creature.vy = -1; // Move up initially (faster movement)
  creature.middleY = creature.minY + (creature.maxY - creature.minY) / 2;
  
  creature.interval = setInterval(() => {
    if (!creature.element || !creature.element.parentNode) {
      clearInterval(creature.interval);
      return;
    }
    
    const currentY = parseInt(creature.element.style.top) || 0;
    const newY = currentY + creature.vy;
    
    // Bounce between middle and bottom
    if (newY <= creature.middleY) {
      creature.vy = Math.abs(creature.vy); // Force downward movement
    } else if (newY >= creature.maxY) {
      creature.vy = -Math.abs(creature.vy); // Force upward movement
    }
    
    // Keep bounded between middle and bottom
    const boundedY = Math.max(creature.middleY, Math.min(newY, creature.maxY));
    
    creature.element.style.top = boundedY + "px";
    creature.y = boundedY;
  }, 60); // Slightly faster update rate
}

// Fish: Start left, move right, bounce back and forth
function startFishMovement(creature) {
  if (!creature || !creature.element || !creature.data) return;
  
  if (creature.interval) clearInterval(creature.interval);
  
  creature.vx = 3; // Start moving right (faster)
  // Set initial facing direction (facing right - no transform needed)
  creature.element.style.transform = creature.data.type === "whale" ? "translateY(100px)" : "none";
  
  creature.interval = setInterval(() => {
    if (!creature.element || !creature.element.parentNode) {
      clearInterval(creature.interval);
      return;
    }
    
    const currentX = parseInt(creature.element.style.left) || 0;
    
    // Update boundaries dynamically for window resize
    creature.minX = 20;
    creature.maxX = Math.max(creature.minX + 50, window.innerWidth - 370 - creature.width);
    
    const newX = currentX + creature.vx;
    
    if (newX <= creature.minX || newX >= creature.maxX) {
      creature.vx = -creature.vx;
      creature.element.style.transform = creature.vx > 0 ? "none" : "scaleX(-1)";
    }
    
    const boundedX = Math.max(creature.minX, Math.min(newX, creature.maxX));
    
    creature.element.style.left = boundedX + "px";
    creature.x = boundedX;
  }, 30); // Faster update rate
}

// Tuna: Start right, move left, bounce back and forth
function startTunaMovement(creature) {
  if (!creature || !creature.element || !creature.data) return;
  
  if (creature.interval) clearInterval(creature.interval);
  
  creature.vx = -1.5; // Start moving left (slower)
  // Set initial facing direction
  creature.element.style.transform = creature.data.type === "whale" ? "translateY(100px) scaleX(-1)" : "scaleX(-1)";
  
  creature.interval = setInterval(() => {
    if (!creature.element || !creature.element.parentNode) {
      clearInterval(creature.interval);
      return;
    }
    
    const currentX = parseInt(creature.element.style.left) || 0;
    
    // Update boundaries dynamically for window resize
    creature.minX = 20;
    creature.maxX = Math.max(creature.minX + 50, window.innerWidth - 370 - creature.width);
    
    const newX = currentX + creature.vx;
    
    if (newX <= creature.minX || newX >= creature.maxX) {
      creature.vx = -creature.vx;
      creature.element.style.transform = creature.vx > 0 ? "none" : "scaleX(-1)";
    }
    
    const boundedX = Math.max(creature.minX, Math.min(newX, creature.maxX));
    
    creature.element.style.left = boundedX + "px";
    creature.x = boundedX;
  }, 50); // Slower update rate
}

// Shark: Start left, move right, bounce back and forth (like fish but faster)
function startSharkMovement(creature) {
  if (!creature || !creature.element || !creature.data) return;
  
  if (creature.interval) clearInterval(creature.interval);
  
  creature.vx = 2; // Start moving right (slower)
  // Set initial facing direction (facing right - no transform needed)
  creature.element.style.transform = "none";
  
  creature.interval = setInterval(() => {
    if (!creature.element || !creature.element.parentNode) {
      clearInterval(creature.interval);
      return;
    }
    
    const currentX = parseInt(creature.element.style.left) || 0;
    
    // Update boundaries dynamically for window resize
    creature.minX = 20;
    creature.maxX = Math.max(creature.minX + 50, window.innerWidth - 370 - creature.width);
    
    const newX = currentX + creature.vx;
    
    if (newX <= creature.minX || newX >= creature.maxX) {
      creature.vx = -creature.vx;
      creature.element.style.transform = creature.vx > 0 ? "none" : "scaleX(-1)";
    }
    
    const boundedX = Math.max(creature.minX, Math.min(newX, creature.maxX));
    
    creature.element.style.left = boundedX + "px";
    creature.x = boundedX;
  }, 50); // Slower update rate
}

// Dolphin: Start right, move left, periodically return to top
function startDolphinMovement(creature) {
  if (!creature || !creature.element || !creature.data) return;
  
  if (creature.interval) clearInterval(creature.interval);
  
  // Diamond pattern waypoints: bottom left → top middle → bottom right → top middle
  creature.waypoints = [
    { x: creature.minX + 50, y: creature.maxY - 50 }, // bottom left
    { x: (creature.minX + creature.maxX) / 2, y: creature.minY + 50 }, // top middle
    { x: creature.maxX - 50, y: creature.maxY - 50 }, // bottom right
    { x: (creature.minX + creature.maxX) / 2, y: creature.minY + 50 }  // top middle
  ];
  creature.currentWaypoint = 0;
  creature.speed = 2;
  
  // Set initial facing direction
  creature.element.style.transform = "none";
  
  creature.interval = setInterval(() => {
    if (!creature.element || !creature.element.parentNode) {
      clearInterval(creature.interval);
      return;
    }
    
    const currentX = parseInt(creature.element.style.left) || 0;
    const currentY = parseInt(creature.element.style.top) || 0;
    
    // Get target waypoint
    const target = creature.waypoints[creature.currentWaypoint];
    
    // Calculate direction to target
    const dx = target.x - currentX;
    const dy = target.y - currentY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // If close to target, move to next waypoint
    if (distance < 20) {
      creature.currentWaypoint = (creature.currentWaypoint + 1) % creature.waypoints.length;
    }
    
    // Move toward target
    const newX = currentX + (dx / distance) * creature.speed;
    const newY = currentY + (dy / distance) * creature.speed;
    
    // Update facing direction based on horizontal movement
    if (dx > 5) {
      creature.element.style.transform = "none"; // facing right
    } else if (dx < -5) {
      creature.element.style.transform = "scaleX(-1)"; // facing left
    }
    
    const boundedX = Math.max(creature.minX, Math.min(newX, creature.maxX));
    const boundedY = Math.max(creature.minY, Math.min(newY, creature.maxY));
    
    creature.element.style.left = boundedX + "px";
    creature.element.style.top = boundedY + "px";
    creature.x = boundedX;
    creature.y = boundedY;
  }, 40);
}

// Whale: Special movement (keeping existing behavior for now)
function startWhaleMovement(creature) {
  // Use horizontal movement for whales for now
  startFishMovement(creature);
}

function updateSelectedCreatureCircle() {
  const circle = document.getElementById("selected-creature-circle");
  if (!circle || !selectedCreature) {
    if (circle) circle.style.display = "none";
    return;
  }
  
  // Get creature position
  const creatureElement = selectedCreature.element;
  const creatureX = parseInt(creatureElement.style.left) || 0;
  const creatureY = parseInt(creatureElement.style.top) || 0;
  const creatureWidth = selectedCreature.width || 50;
  const creatureHeight = selectedCreature.height || 50;
  
  // Calculate circle size (smaller flashlight beam)
  const circleSize = Math.max(creatureWidth, creatureHeight) + 40; // Larger for better flashlight effect
  
  // Center the circle on the creature
  const circleX = creatureX + (creatureWidth / 2) - (circleSize / 2);
  const circleY = creatureY + (creatureHeight / 2) - (circleSize / 2);
  
  // Update circle position and size
  circle.style.left = `${circleX}px`;
  circle.style.top = `${circleY}px`;
  circle.style.width = `${circleSize}px`;
  circle.style.height = `${circleSize}px`;
  circle.style.display = "block";
}

// Continuously update the flashlight position
function startFlashlightTracking() {
  setInterval(() => {
    if (selectedCreature) {
      updateSelectedCreatureCircle();
    }
  }, 50); // Update every 50ms to smoothly follow the creature
}


function setSelectedCreature(creature) {
  selectedCreature = creature;
  updateSelectedCreatureCircle();
  console.log("🎯 Selected creature:", creature ? creature.data.type : "none");
}

// Focus on a creature by its address
function focusOnCreatureByAddress(address) {
  console.log("🔍 Searching for creature with address:", address.slice(0, 10) + "...");
  
  // Find the creature with the matching address
  const targetCreature = currentCreatures.find(creature => 
    creature.data && creature.data.address === address
  );
  
  if (targetCreature) {
    console.log("✅ Found creature:", targetCreature.data.type, "at", targetCreature.x, targetCreature.y);
    
    // Set as selected creature (this updates the flashlight)
    setSelectedCreature(targetCreature);
    
    // Update info panel with the new creature's data
    showInfo(targetCreature.data);
    
    console.log("🎯 Switched focus to:", targetCreature.data.type, "creature");
  } else {
    console.log("❌ No creature found with address:", address.slice(0, 10) + "...");
    console.log("Available creatures:", currentCreatures.map(c => ({
      type: c.data?.type, 
      address: c.data?.address?.slice(0, 10) + "..."
    })));
  }
}

function updateCreatureBoundary() {
  const boundary = document.getElementById("creature-boundary");
  if (!boundary) {
    console.warn("❌ creature-boundary element not found!");
    return;
  }
  
  // Show ACTUAL usable space, don't try to avoid overlapping
  const minX = 20;
  const minY = 120;
  
  // Calculate the real available space (even if tiny)
  const realAvailableWidth = window.innerWidth - 370; // Space before info panel
  const realAvailableHeight = window.innerHeight - 220; // Space after title and margins
  
  // Show the actual boundary, even if it's small or overlaps
  let boundaryWidth, boundaryHeight;
  
  if (realAvailableWidth < 100) {
    // If very narrow, show what we have but make it at least visible
    boundaryWidth = Math.max(50, realAvailableWidth);
    console.log("🔴 VERY NARROW WINDOW - showing minimal boundary:", boundaryWidth);
  } else {
    boundaryWidth = realAvailableWidth;
  }
  
  if (realAvailableHeight < 100) {
    // If very short, show what we have but make it at least visible  
    boundaryHeight = Math.max(50, realAvailableHeight);
    console.log("🔴 VERY SHORT WINDOW - showing minimal boundary:", boundaryHeight);
  } else {
    boundaryHeight = realAvailableHeight;
  }
  
  const maxX = minX + boundaryWidth;
  const maxY = minY + boundaryHeight;
  
  boundary.style.left = minX + "px";
  boundary.style.top = minY + "px";
  boundary.style.width = boundaryWidth + "px";
  boundary.style.height = boundaryHeight + "px";
  boundary.style.display = "block";
  boundary.style.visibility = "visible";
  boundary.style.opacity = "0.8";
  
  console.log("🔲 FORCED boundary display:", { 
    minX, minY, maxX, maxY, 
    width: boundaryWidth, 
    height: boundaryHeight,
    window: `${window.innerWidth}x${window.innerHeight}`,
    available: `${realAvailableWidth}x${realAvailableHeight}`
  });
}

document.getElementById("pause-btn").onclick = () => {
  console.log("PAUSE BUTTON CLICKED - paused was:", paused);
  
  paused = !paused;
  document.getElementById("pause-btn").innerText = paused ? "▶" : "⏸";
  
  console.log("PAUSE BUTTON - now paused is:", paused);
  
  // Just stop/start movement - don't touch images for now
  if (paused) {
    console.log("PAUSE - stopping all movement");
    currentCreatures.forEach(creature => {
      if (creature.interval) {
        clearInterval(creature.interval);
        creature.interval = null;
      }
    });
  } else {
    console.log("UNPAUSE - restarting movement");
    currentCreatures.forEach(creature => {
      // Restart movement based on creature type
      switch(creature.data.type) {
        case "shrimp":
          startShrimpMovement(creature);
          break;
        case "crab":
          startCrabMovement(creature);
          break;
        case "octopus":
          startOctopusMovement(creature);
          break;
        case "fish":
          startFishMovement(creature);
          break;
        case "tuna":
          startTunaMovement(creature);
          break;
        case "shark":
          startSharkMovement(creature);
          break;
        case "dolphin":
          startDolphinMovement(creature);
          break;
        case "whale":
          startWhaleMovement(creature);
          break;
        default:
          startFishMovement(creature);
      }
    });
  }
};

document.getElementById("block-prev").onclick = () => {
  searchBlockHeight = Math.max(1, searchBlockHeight - 1);
  document.getElementById("block-input").value = searchBlockHeight;
  fetchSearchBlock();
};

document.getElementById("block-next").onclick = () => {
  searchBlockHeight++;
  document.getElementById("block-input").value = searchBlockHeight;
  fetchSearchBlock();
};

document.getElementById("block-input").onchange = (e) => {
  searchBlockHeight = parseInt(e.target.value) || 1;
  fetchSearchBlock();
};

document.getElementById("latest-btn").onclick = () => {
  console.log("Latest button clicked - fetching latest block");
  fetch("/latest").then(res => res.json()).then(data => {
    if (data.height && data.height > 1000000 && data.height < 20000000) { // Sanity check for reasonable block height
      console.log("Latest block found:", data.height);
      searchBlockHeight = data.height;
      document.getElementById("block-input").value = searchBlockHeight;
      findBlockWithCreatures(); // Use findBlockWithCreatures to ensure we get creatures
    } else {
      console.log("Invalid or no latest block data:", data.height);
      // Fallback: try a reasonable recent block (rough estimate based on current time)
      const estimatedBlock = Math.floor((Date.now() - new Date('2017-09-23').getTime()) / (20 * 1000)) + 1000000;
      searchBlockHeight = Math.min(estimatedBlock, 15000000); // Cap at reasonable max
      console.log("Using estimated block:", searchBlockHeight);
      document.getElementById("block-input").value = searchBlockHeight;
      findBlockWithCreatures();
    }
  }).catch(error => {
    console.error("Error fetching latest block:", error);
    // Fallback: estimate based on Cardano launch + time
    const estimatedBlock = Math.floor((Date.now() - new Date('2017-09-23').getTime()) / (20 * 1000)) + 1000000;
    searchBlockHeight = Math.min(estimatedBlock, 15000000);
    console.log("Using fallback estimated block:", searchBlockHeight);
    document.getElementById("block-input").value = searchBlockHeight;
    findBlockWithCreatures();
  });
};


// Get latest block height on startup and find one with creatures
fetch("/latest").then(res => res.json()).then(data => {
  if (data.height) {
    searchBlockHeight = data.height;
    findBlockWithCreatures();
  } else {
    // Fallback to a known block if no latest data
    searchBlockHeight = 3744495;
    document.getElementById("block-input").value = searchBlockHeight;
    fetchSearchBlock();
  }
}).catch(error => {
  console.error("Error fetching latest block:", error);
  // Fallback to a known block
  searchBlockHeight = 3744495;
  document.getElementById("block-input").value = searchBlockHeight;
  fetchSearchBlock();
});

// Function to find a block with creatures by searching backwards
function findBlockWithCreatures() {
  console.log("Looking for block with creatures, trying:", searchBlockHeight);
  fetch(`/block/${searchBlockHeight}`).then(res => res.json()).then(data => {
    if (data.error || !data.creatures || data.creatures.length === 0) {
      // No creatures in this block, try the previous one
      searchBlockHeight = Math.max(1, searchBlockHeight - 1);
      if (searchBlockHeight >= 3744000) { // Don't search too far back
        findBlockWithCreatures();
      } else {
        // Give up and use fallback
        searchBlockHeight = 3744495; // Block we know has creatures
        document.getElementById("block-input").value = searchBlockHeight;
        fetchSearchBlock();
      }
    } else {
      // Found a block with creatures!
      console.log("Found block with creatures:", searchBlockHeight);
      document.getElementById("block-input").value = searchBlockHeight;
      fetchSearchBlock();
    }
  }).catch(error => {
    console.error("Error in findBlockWithCreatures:", error);
    searchBlockHeight = 3744495; // Block we know has creatures
    document.getElementById("block-input").value = searchBlockHeight;
    fetchSearchBlock();
  });
}

function clearAquarium() {
  currentCreatures.forEach(creature => {
    if (creature.interval) {
      clearInterval(creature.interval);
      creature.interval = null;
    }
  });
  currentCreatures = [];
  
  // Clear all active arrows
  activeArrows.forEach(arrowData => {
    if (arrowData.element.parentNode) {
      arrowData.element.parentNode.removeChild(arrowData.element);
    }
    if (arrowData.updateInterval) {
      clearInterval(arrowData.updateInterval);
    }
  });
  activeArrows = [];
  
  
  aquarium.innerHTML = `
    <div id="radar-line"></div>
    <div id="creature-boundary"></div>
    <div id="selected-creature-circle"></div>
  `;
}




function showInfo(c) {
  console.log("showInfo called with:", c);
  
  // Find the creature object that matches this data
  const creatureObj = currentCreatures.find(creature => 
    creature.data.address === c.address && creature.data.type === c.type
  );
  
  // Set as selected creature for green circle
  setSelectedCreature(creatureObj);
  
  const infoContent = document.getElementById("info-content");
  console.log("Info content element:", infoContent);
  
  // Define ADA ranges for each creature type
  const adaRanges = {
    shrimp: "< 100 ADA",
    crab: "100 - 999 ADA", 
    octopus: "1,000 - 2,999 ADA",
    fish: "3,000 - 9,999 ADA",
    tuna: "10,000 - 39,999 ADA",
    dolphin: "40,000 - 99,999 ADA",
    shark: "100,000 - 299,999 ADA",
    whale: "300,000+ ADA"
  };
  
  infoContent.innerHTML = `
    <div style="margin-bottom: 15px;">
      <b style="color: #2d4a3e; font-size: 13px;">Creature Type:</b><br>
      <span style="color: #8B4513; font-weight: bold; font-size: 14px; text-transform: capitalize;">${c.type}</span><br>
      <span style="color: #666; font-size: 11px; font-style: italic;">(${adaRanges[c.type] || 'Unknown range'})</span>
    </div>
    
    <div style="margin-bottom: 15px;">
      <b style="color: #2d4a3e; font-size: 13px;">Address:</b><br>
      <span style="font-size: 10px; word-break: break-all; line-height: 1.2;">${c.address}</span>
    </div>
    
    <div style="margin-bottom: 15px;">
      <b style="color: #2d4a3e; font-size: 13px;">ADA Balance:</b><br>
      <span style="color: #0066cc; font-weight: bold; font-size: 12px;">${c.ada} ADA</span>
    </div>
    
    <div style="margin-bottom: 15px;">
      <b style="color: #2d4a3e; font-size: 13px;">Role:</b><br>
      <span style="color: #666; font-size: 12px;">${c.role || 'N/A'}</span>
    </div>
    
    <div style="margin-bottom: 15px;">
      <b style="color: #2d4a3e; font-size: 13px;">Transaction ID:</b><br>
      <span style="font-size: 10px; word-break: break-all; line-height: 1.2;">${c.transaction_id || 'N/A'}</span>
    </div>
    
    <div style="margin-bottom: 15px;">
      <b style="color: #2d4a3e; font-size: 13px;">Amount Transferred:</b><br>
      <span style="color: #cc6600; font-weight: bold; font-size: 12px;">${c.amount_transferred ? c.amount_transferred.toFixed(2) + ' ADA' : 'N/A'}</span>
    </div>
    
    ${c.sent_to_info && c.sent_to_info.length > 0 ? `
    <div style="margin-bottom: 15px;">
      <b style="color: #2d4a3e; font-size: 13px;">Sent To:</b><br>
      ${c.sent_to_info.map(recipient => `
        <div style="margin: 8px 0; padding: 8px; background: rgba(255,0,0,0.1); border-radius: 4px; cursor: pointer; transition: background 0.2s;" 
             onclick="focusOnCreatureByAddress('${recipient.address}')" 
             onmouseover="this.style.background='rgba(255,0,0,0.2)'" 
             onmouseout="this.style.background='rgba(255,0,0,0.1)'">
          <div style="font-size: 9px; word-break: break-all; line-height: 1.1; color: #555;">${recipient.address}</div>
          <div style="margin-top: 4px;">
            <span style="color: #8B4513; font-weight: bold; font-size: 11px; text-transform: capitalize;">${recipient.type}</span>
            <span style="color: #0066cc; font-size: 10px; margin-left: 8px;">${recipient.ada} ADA</span>
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}
    
    ${c.received_from_info && c.received_from_info.length > 0 ? `
    <div style="margin-bottom: 10px;">
      <b style="color: #2d4a3e; font-size: 13px;">Received From:</b><br>
      ${c.received_from_info.map(sender => `
        <div style="margin: 8px 0; padding: 8px; background: rgba(0,255,0,0.1); border-radius: 4px; cursor: pointer; transition: background 0.2s;" 
             onclick="focusOnCreatureByAddress('${sender.address}')" 
             onmouseover="this.style.background='rgba(0,255,0,0.2)'" 
             onmouseout="this.style.background='rgba(0,255,0,0.1)'">
          <div style="font-size: 9px; word-break: break-all; line-height: 1.1; color: #555;">${sender.address}</div>
          <div style="margin-top: 4px;">
            <span style="color: #8B4513; font-weight: bold; font-size: 11px; text-transform: capitalize;">${sender.type}</span>
            <span style="color: #0066cc; font-size: 10px; margin-left: 8px;">${sender.ada} ADA</span>
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}
  `;
}

function animate() {
  if (!paused && isNightMode) {
    radarPosition += 0.5; // Slower movement for night mode
    if (radarPosition > window.innerWidth) radarPosition = -10;
    document.getElementById("radar-line").style.left = radarPosition + "px";
  }
  requestAnimationFrame(animate);
}

function fetchSearchBlock() {
  console.log("*** FETCH SEARCH BLOCK CALLED ***", searchBlockHeight);
  fetch(`/block/${searchBlockHeight}`).then(res => res.json()).then(data => {
    console.log("*** BLOCK DATA RECEIVED ***", data);
    console.log("*** NUMBER OF CREATURES ***", data.creatures ? data.creatures.length : 0);
    
    if (data.error) {
      console.error("Block not found:", data.error);
      return;
    }

    clearAquarium();
    console.log("Aquarium cleared, processing creatures...");
    
    let blockLabel = document.querySelector('#search-block-label');
    if (!blockLabel) {
      blockLabel = document.createElement("div");
      blockLabel.id = "search-block-label";
      blockLabel.style.position = "absolute";
      blockLabel.style.top = "10px";
      blockLabel.style.left = "50%";
      blockLabel.style.transform = "translateX(-50%)";
      blockLabel.style.color = "white";
      blockLabel.style.fontSize = "22px";
      blockLabel.style.fontWeight = "bold";
      blockLabel.style.textShadow = "1px 1px 4px black";
      aquarium.appendChild(blockLabel);
    }
    blockLabel.innerText = `Search Block: ${data.height}`;

    if (data.creatures.length === 0) {
      // Show ghost for empty block in search mode
      const emptyImg = document.createElement("img");
      emptyImg.src = "/resources/images/empty.gif";
      emptyImg.className = "empty-block-search";
      emptyImg.style.position = "absolute";
      emptyImg.style.left = "50%";
      emptyImg.style.top = "50%";
      emptyImg.style.transform = "translate(-50%, -50%)";
      emptyImg.style.height = "150px";
      emptyImg.style.width = "auto";
      emptyImg.style.filter = "brightness(0.7) contrast(1.2)";
      emptyImg.style.zIndex = "20";
      aquarium.appendChild(emptyImg);
      
      const spookyText = document.createElement("div");
      spookyText.className = "spooky-text-search";
      spookyText.innerText = "No Transactions in this Block";
      spookyText.style.position = "absolute";
      spookyText.style.left = "50%";
      spookyText.style.top = "65%";
      spookyText.style.transform = "translateX(-50%)";
      spookyText.style.color = "#ff6b6b";
      spookyText.style.fontSize = "16px";
      spookyText.style.fontWeight = "bold";
      spookyText.style.textShadow = "0 0 10px #ff6b6b, 0 0 20px #ff0000";
      spookyText.style.animation = "spookyGlow 2s ease-in-out infinite alternate";
      spookyText.style.textAlign = "center";
      spookyText.style.zIndex = "20";
      aquarium.appendChild(spookyText);
    } else {
      console.log("*** JAVASCRIPT IS RUNNING - Processing creatures:", data.creatures);
      
      // Ensure boundary stays visible after creatures load
      updateCreatureBoundary();
      
      // Calculate size based on ADA amount for more realistic scaling
      function calculateCreatureSize(ada, type) {
          let baseSize;
          let scaleFactor = 1;
          
          // Base sizes properly ordered: shrimp < crab < octopus < fish < tuna < dolphin < shark < whale
          if (type === "shrimp") {
            baseSize = 20; // Smallest (< 100 ADA)
            scaleFactor = Math.max(1, Math.min(ada / 50, 2)); // 1x to 2x
          } else if (type === "crab") {
            baseSize = 30; // (100-1000 ADA)
            scaleFactor = Math.max(1, Math.min((ada - 100) / 450 + 1, 2)); // 1x to 2x
          } else if (type === "octopus") {
            baseSize = 45; // (1000-3000 ADA)
            scaleFactor = Math.max(1, Math.min((ada - 1000) / 1000 + 1, 2)); // 1x to 2x
          } else if (type === "fish") {
            baseSize = 40; // (3000-10000 ADA) - smaller than before
            scaleFactor = Math.max(1, Math.min((ada - 3000) / 3500 + 1, 1.5)); // 1x to 1.5x
          } else if (type === "tuna") {
            baseSize = 80; // (10000-40000 ADA) - bigger than fish
            scaleFactor = Math.max(1, Math.min((ada - 10000) / 15000 + 1, 2)); // 1x to 2x
          } else if (type === "dolphin") {
            baseSize = 120; // (40000-100000 ADA) - bigger than tuna
            scaleFactor = Math.max(1, Math.min((ada - 40000) / 30000 + 1, 2.2)); // 1x to 2.2x
          } else if (type === "shark") {
            baseSize = 180; // (100000-300000 ADA) - larger than dolphins, smaller than whales
            scaleFactor = Math.max(1, Math.min((ada - 100000) / 100000 + 1, 2.5)); // 1x to 2.5x
          } else { // whale
            baseSize = 350; // (300000+ ADA) - largest creatures
            scaleFactor = Math.max(1, Math.min((ada - 300000) / 200000 + 1, 3)); // 1x to 3x
          }
          
          return Math.floor(baseSize * scaleFactor);
        }
      
      // First, create all creatures
      for (const c of data.creatures) {
        console.log("*** CREATING CREATURE ***", c.type, "with ADA:", c.ada);
        const img = document.createElement("img");
        img.src = paused ? creatureImages[c.type].png : creatureImages[c.type].gif;
        img.className = "creature";
        console.log("IMG element created:", img);
        
        const creatureSize = calculateCreatureSize(c.ada, c.type);
        const creatureWidth = creatureSize;
        const creatureHeight = creatureSize;
        
        // Set size based on calculated creature size
        img.style.height = creatureSize + "px";
        img.style.width = "auto";
        
        // Only apply translateY for whales
        if (c.type === "whale") {
          img.style.transform = "translateY(100px)";
        }
        img.style.opacity = "0";
        aquarium.appendChild(img);
        console.log("=== CREATURE APPENDED TO DOM ===", c.type);

        // FORCE IMMEDIATE POSITIONING - don't wait for onload
        console.log("*** POSITIONING CREATURE IMMEDIATELY ***", c.type);
        
        console.log(`*** CREATURE ${c.type} DIMENSIONS: ${creatureWidth}x${creatureHeight}, WINDOW: ${window.innerWidth}x${window.innerHeight} ***`);
        
        // Account for whale's translateY transform
        const extraY = c.type === "whale" ? 100 : 0;
          
        // Ensure creatures stay fully visible in window with generous margins
        const minX = 20;
        const maxX = Math.max(minX + 50, window.innerWidth - 370 - creatureWidth); // Account for info panel
        const minY = 120; // Below the title
        const maxY = Math.max(minY + 50, window.innerHeight - 100 - creatureHeight - extraY); // Stay above bottom
        
        // Position creatures based on their type
        let x, y;
        let attempts = 0;
        const maxAttempts = 50;
        
        // Different starting positions for different creatures
        if (c.type === "tuna") {
          // Tuna starts on the right
          x = maxX;
        } else if (c.type === "dolphin") {
          // Dolphin starts at bottom center
          x = minX + (maxX - minX) / 2;
          y = maxY; // Bottom
        } else if (c.type === "crab") {
          // Crabs start at bottom
          x = Math.random() * (maxX - minX) + minX;
          y = maxY; // Bottom
        } else if (c.type === "octopus") {
          // Octopus starts at bottom center
          x = minX + (maxX - minX) / 2;
          y = maxY;
        } else if (c.type === "fish") {
          // Fish start on left but staggered vertically
          x = minX;
          const fishIndex = currentCreatures.filter(creature => creature.data.type === "fish").length;
          const staggerOffset = (fishIndex * 80) % (maxY - minY - 100); // Stagger every 80px, wrap around
          y = minY + 50 + staggerOffset; // Start 50px from top, then stagger
          y = Math.max(minY, Math.min(y, maxY)); // Ensure within bounds
        } else {
          // Shark, shrimp, whale start on the left
          x = minX;
        }
        
        // Find Y position if not already set
        if (y === undefined) {
          do {
            y = Math.random() * (maxY - minY) + minY;
            y = Math.max(minY, Math.min(y, maxY));
            attempts++;
          } while (attempts < maxAttempts && isPositionOccupied(x, y, creatureWidth, creatureHeight));
        }
        
        // Helper function to check if position overlaps with existing creatures
        function isPositionOccupied(newX, newY, width, height) {
          for (const existingCreature of currentCreatures) {
            const existingX = parseInt(existingCreature.element.style.left) || 0;
            const existingY = parseInt(existingCreature.element.style.top) || 0;
            const existingWidth = existingCreature.width || 50;
            const existingHeight = existingCreature.height || 50;
            
            // Check for overlap with padding
            const padding = 30;
            if (newX < existingX + existingWidth + padding && 
                newX + width + padding > existingX &&
                newY < existingY + existingHeight + padding && 
                newY + height + padding > existingY) {
              return true;
            }
          }
          return false;
        }
        
        console.log(`*** POSITIONING ${c.type} AT x:${x} (${minX}-${maxX}), y:${y} (${minY}-${maxY}) ***`);
        
        // REMOVED: All velocity and directional spawning code
        // Creatures will spawn randomly and remain stationary

        img.style.left = `${x}px`;
        img.style.top = `${y}px`;
        
        // Create the creature object 
        const creatureObj = { 
          element: img, 
          data: c, 
          x: x, 
          y: y, 
          width: creatureWidth, 
          height: creatureHeight,
          minX: minX,
          maxX: maxX,
          minY: minY,
          maxY: maxY
        };
        currentCreatures.push(creatureObj);
        
        // Start movement based on creature type
        switch(c.type) {
          case "shrimp":
            startShrimpMovement(creatureObj);
            break;
          case "crab":
            startCrabMovement(creatureObj);
            break;
          case "octopus":
            startOctopusMovement(creatureObj);
            break;
          case "fish":
            startFishMovement(creatureObj);
            break;
          case "tuna":
            startTunaMovement(creatureObj);
            break;
          case "shark":
            startSharkMovement(creatureObj);
            break;
          case "dolphin":
            startDolphinMovement(creatureObj);
            break;
          case "whale":
            startWhaleMovement(creatureObj);
            break;
          default:
            startFishMovement(creatureObj); // Default behavior
        }
        
        // Show the creature after positioning
        setTimeout(() => {
          img.style.opacity = "1";
          console.log("=== CREATURE NOW VISIBLE ===", c.type);
        }, 100);

        // SIMPLE TEST - just log and do NOTHING ELSE
        img.onclick = (e) => {
          console.log("CLICK TEST - before any action, position:", img.style.left, img.style.top);
          e.stopPropagation();
          showInfo(c);
          console.log("CLICK TEST - after showInfo, position:", img.style.left, img.style.top);
        };
        
        img.onmousedown = (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const currentX = parseInt(img.style.left) || 0;
          const currentY = parseInt(img.style.top) || 0;
          
          draggedCreature = { element: img };
          dragOffset.x = e.clientX - currentX;
          dragOffset.y = e.clientY - currentY;
          img.classList.add('dragging');
          
          // Switch to click image
          img.dataset.originalSrc = img.src;
          img.src = `/resources/images/${c.type}_click.png`;
        };

      }
      
      // After all creatures are created and positioned, ensure boundary is visible
      setTimeout(() => {
        updateCreatureBoundary(); // Ensure boundary stays visible
      }, 200);
    }
  }).catch(error => {
    console.error("Error fetching block:", error);
  });
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", function() {
  document.getElementById("radar-line").style.display = "none";
  document.getElementById("search-controls").style.display = "block";
  updateCreatureBoundary();
  startFlashlightTracking(); // Start tracking the flashlight
  
  console.log("🚀 DOM ready - boundary should be visible");
});

// Update boundary on window resize
window.addEventListener("resize", updateCreatureBoundary);

function updateCreatureBoundary() {
  const boundary = document.getElementById("creature-boundary");
  if (!boundary) return;
  
  // Calculate proper boundary based on window size
  const minX = 20;
  const minY = 120;
  const maxX = window.innerWidth - 370; // Account for info panel
  const maxY = window.innerHeight - 120;
  
  const width = Math.max(100, maxX - minX);
  const height = Math.max(100, maxY - minY);
  
  boundary.style.position = "absolute";
  boundary.style.left = minX + "px";
  boundary.style.top = minY + "px";
  boundary.style.width = width + "px";
  boundary.style.height = height + "px";
  boundary.style.border = "3px solid red";
  boundary.style.backgroundColor = "rgba(255, 0, 0, 0.1)";
  boundary.style.display = "block";
  boundary.style.pointerEvents = "none";
  boundary.style.zIndex = "5";
  boundary.style.boxSizing = "border-box";
}

document.onmousemove = (e) => {
  if (draggedCreature) {
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    const creature = currentCreatures.find(c => c.element === draggedCreature.element);
    if (creature) {
      const creatureWidth = creature.width || draggedCreature.element.offsetWidth;
      const creatureHeight = creature.height || draggedCreature.element.offsetHeight;
      
      const boundedX = Math.max(0, Math.min(newX, window.innerWidth - creatureWidth));
      const boundedY = Math.max(100, Math.min(newY, window.innerHeight - creatureHeight));
      
      draggedCreature.element.style.left = `${boundedX}px`;
      draggedCreature.element.style.top = `${boundedY}px`;
      
      creature.x = boundedX;
      creature.y = boundedY;
    }
  }
};

document.onmouseup = () => {
  if (draggedCreature) {
    draggedCreature.element.classList.remove('dragging');
    
    // Find the creature object to restart its movement
    const creature = currentCreatures.find(c => c.element === draggedCreature.element);
    if (creature) {
      // Restart movement based on creature type
      switch(creature.data.type) {
        case "shrimp":
          startShrimpMovement(creature);
          break;
        case "crab":
          // For crabs, they should fall back down quickly if dragged up
          startCrabMovement(creature);
          break;
        case "octopus":
          startOctopusMovement(creature);
          break;
        case "fish":
          startFishMovement(creature);
          break;
        case "tuna":
          startTunaMovement(creature);
          break;
        case "shark":
          startSharkMovement(creature);
          break;
        case "dolphin":
          startDolphinMovement(creature);
          break;
        case "whale":
          startWhaleMovement(creature);
          break;
        default:
          startFishMovement(creature);
      }
    }
    
    // Restore original image if it was changed
    if (draggedCreature.element.dataset.originalSrc) {
      draggedCreature.element.src = draggedCreature.element.dataset.originalSrc;
      delete draggedCreature.element.dataset.originalSrc;
    }
    
    draggedCreature = null;
  }
};

// Background click to make creatures swim towards click point
document.onclick = (e) => {
  if (e.target.classList.contains('creature')) return; // Don't trigger on creature clicks
  if (e.target.id === 'block-input' || e.target.id === 'block-prev' || e.target.id === 'block-next') return; // Don't trigger on search controls
  
  const targetX = e.clientX;
  const targetY = e.clientY;
  
  // Create ripple effect
  const ripple = document.createElement('div');
  ripple.className = 'ripple-effect';
  ripple.style.left = (targetX - 10) + 'px';
  ripple.style.top = (targetY - 10) + 'px';
  document.body.appendChild(ripple);
  
  // Remove ripple after animation completes
  setTimeout(() => {
    if (ripple.parentNode) {
      ripple.parentNode.removeChild(ripple);
    }
  }, 1000);
  
  // Click-to-move disabled - creatures swim horizontally
  console.log("Click detected but creatures continue horizontal swimming");
};

// Network toggle functionality
let currentNetwork = 'preprod';

async function toggleNetwork() {
  const button = document.getElementById('network-toggle');
  const targetNetwork = currentNetwork === 'preprod' ? 'mainnet' : 'preprod';
  
  // Disable button during switch
  button.disabled = true;
  button.textContent = 'switching...';
  
  try {
    // Call backend API to switch networks
    const response = await fetch('/switch-network', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({network: targetNetwork})
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Update frontend state
      currentNetwork = result.network;
      button.textContent = currentNetwork;
      
      if (currentNetwork === 'mainnet') {
        button.classList.add('mainnet');
      } else {
        button.classList.remove('mainnet');
      }
      
      showNetworkNotification(currentNetwork);
      
      // Clear any existing creatures since we're on a different network
      clearAllCreatures();
      
      console.log(`✅ Network switched to: ${currentNetwork}`);
    } else {
      throw new Error(result.error || 'Network switch failed');
    }
  } catch (error) {
    console.error('❌ Network switch failed:', error);
    showNetworkNotification('error', `Failed to switch to ${targetNetwork}`);
    
    // Reset button to current state
    button.textContent = currentNetwork;
    if (currentNetwork === 'mainnet') {
      button.classList.add('mainnet');
    } else {
      button.classList.remove('mainnet');
    }
  } finally {
    button.disabled = false;
  }
}

function clearAllCreatures() {
  // Remove all existing creatures from the aquarium
  const creatures = document.querySelectorAll('.creature');
  creatures.forEach(creature => {
    if (creature.parentNode) {
      creature.parentNode.removeChild(creature);
    }
  });
  
  // Clear creature arrays/objects if they exist
  if (typeof allCreatures !== 'undefined') {
    allCreatures.length = 0;
  }
  
  console.log('🧹 Cleared all creatures for network switch');
}

function showNetworkNotification(network, customMessage = null) {
  // Create notification element
  const notification = document.createElement('div');
  
  let backgroundColor, message;
  if (network === 'error') {
    backgroundColor = '#ff4444';
    message = customMessage || 'Network switch failed';
  } else {
    backgroundColor = network === 'mainnet' ? '#ff6b6b' : '#4CAF50';
    message = customMessage || `Switched to ${network.toUpperCase()}`;
  }
  
  notification.style.cssText = `
    position: fixed;
    top: 50px;
    right: 20px;
    background: ${backgroundColor};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-weight: bold;
    z-index: 1000;
    opacity: 0;
    transition: opacity 0.3s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Fade in
  setTimeout(() => notification.style.opacity = '1', 10);
  
  // Fade out and remove
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, network === 'error' ? 4000 : 2000); // Show errors longer
}

animate();