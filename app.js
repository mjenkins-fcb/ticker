// app.js

// DOM Elements
const inputText = document.getElementById("input-text");
const colorwayRadios = document.querySelectorAll('input[name="colorway"]');
const separationOption = document.getElementById("separation-option");
const scrollSpeedInput = document.getElementById("scrollSpeed");
const frameDelayInput = document.getElementById("frameDelay");
const canvasWidthInput = document.getElementById("canvasWidth");
const canvasHeightInput = document.getElementById("canvasHeight");
const verticalOffsetInput = document.getElementById("verticalOffset");
const toggleAdvancedControlsButton = document.getElementById(
  "toggle-advanced-controls"
);
const advancedControlsDiv = document.getElementById("advanced-controls");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const gifPreview = document.getElementById("gif-preview");
const downloadLink = document.getElementById("download-link");
const loadingIndicator = document.getElementById("loading-indicator");
const fileSizeDisplay = document.getElementById("file-size");
const fileSizeValue = document.getElementById("file-size-value");

const MAX_FILE_SIZE = 300 * 1024; // 300 KB

// Debounce function to limit the rate of GIF rendering
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const debounceRenderGIF = debounce(loadResourcesAndRenderGIF, 500);

// Event Listeners
[
  inputText,
  separationOption,
  scrollSpeedInput,
  frameDelayInput,
  canvasWidthInput,
  canvasHeightInput,
  verticalOffsetInput,
].forEach((element) => {
  element.addEventListener("input", debounceRenderGIF);
});

colorwayRadios.forEach((radio) => {
  radio.addEventListener("change", debounceRenderGIF);
});

// Toggle advanced controls
toggleAdvancedControlsButton.addEventListener("click", () => {
  const isHidden = advancedControlsDiv.style.display === "none";
  advancedControlsDiv.style.display = isHidden ? "block" : "none";
  toggleAdvancedControlsButton.textContent = isHidden
    ? "Hide Advanced Controls"
    : "Show Advanced Controls";
});

// Font loading and caching
let fontsLoaded = false;

// Diamond image loading
let diamondImageLoaded = false;
const diamondImage = new Image();
diamondImage.src = "diamond.svg";
diamondImage.onload = () => {
  diamondImageLoaded = true;
  if (fontsLoaded) {
    renderGIF(inputText.value.trim().toUpperCase());
  }
};

function loadResourcesAndRenderGIF() {
  const text = inputText.value.trim().toUpperCase();
  if (!text) {
    resetPreview();
    return;
  }

  showLoadingIndicator();

  if (fontsLoaded && diamondImageLoaded) {
    renderGIF(text);
    return;
  }

  loadFonts(text);
}

// Load fonts with specific variations
function loadFonts(text) {
  // Define font widths and weights
  const fontStyles = {
    thin: { width: 50, weight: 340, family: "FactThin" },
    normal: { width: 74, weight: 572, family: "FactNormal" },
    fat: { width: 200, weight: 900, family: "FactFat" },
  };

  // Create FontFace instances for each style
  const fontFaces = [];
  for (const style in fontStyles) {
    const { width, weight, family } = fontStyles[style];
    const fontFace = new FontFace(family, "url('fact-vf.woff2')", {
      weight: weight.toString(),
      stretch: `${width}%`,
      style: "normal",
      variationSettings: `"wght" ${weight}, "wdth" ${width}`,
    });
    fontFaces.push(fontFace.load());
  }

  // Load the fonts and add them to the document
  Promise.all(fontFaces)
    .then((loadedFonts) => {
      loadedFonts.forEach((font) => document.fonts.add(font));
      // Wait for fonts to be ready
      document.fonts.ready.then(() => {
        fontsLoaded = true;
        if (diamondImageLoaded) {
          renderGIF(text);
        }
      });
    })
    .catch((error) => {
      console.error("Error loading fonts:", error);
      hideLoadingIndicator();
      alert("Failed to load fonts. Please try again.");
    });
}

// Parse input text for styling
function parseStyledText(input) {
  const regex = /(\*\*[^*]+\*\*|_[^_]+_)/g;
  const parts = [];
  let lastIndex = 0;

  let match;
  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      // Add normal text before the match
      parts.push({
        text: input.substring(lastIndex, match.index),
        style: "normal",
      });
    }

    const marker = match[0];

    if (marker.startsWith("**") && marker.endsWith("**")) {
      // Fat text
      parts.push({
        text: marker.slice(2, -2),
        style: "fat",
      });
    } else if (marker.startsWith("_") && marker.endsWith("_")) {
      // Thin text
      parts.push({
        text: marker.slice(1, -1),
        style: "thin",
      });
    }

    lastIndex = regex.lastIndex;
  }

  // Add any remaining normal text
  if (lastIndex < input.length) {
    parts.push({
      text: input.substring(lastIndex),
      style: "normal",
    });
  }

  return parts.filter((part) => part.text.length > 0);
}

// Render the GIF
function renderGIF(text) {
  const colorway = getSelectedColorway();
  const separationValue = separationOption.value;

  const scrollSpeed = parseFloat(scrollSpeedInput.value);
  const frameDelay = parseFloat(frameDelayInput.value);

  // Get canvas dimensions
  const gifWidth = parseInt(canvasWidthInput.value, 10);
  const gifHeight = parseInt(canvasHeightInput.value, 10);

  // Limit canvas dimensions to prevent excessively large GIFs
  const maxGifWidth = 1280;
  const maxGifHeight = 200;
  canvas.width = Math.min(gifWidth, maxGifWidth);
  canvas.height = Math.min(gifHeight, maxGifHeight);

  // Adjust font size based on canvas height
  const fontSize = canvas.height * 0.95;

  const gif = new GIF({
    workers: 2,
    quality: 1, // Set GIF quality to high
    width: canvas.width,
    height: canvas.height,
    workerScript: "./gif.worker.js",
  });

  // Set background and text colors based on the selected colorway
  const { bgColor, textColor } = getColorwayColors(colorway);

  const parts = parseStyledText(text);

  // Determine separation settings
  const { gap, addSeparator } = getSeparationSettings(separationValue);

  // Define font styles
  const fontStyles = {
    thin: { family: "FactThin" },
    normal: { family: "FactNormal" },
    fat: { family: "FactFat" },
  };

  const iconPadding = 20; // Padding around the icon

  const contentWidth = calculateContentWidth(
    parts,
    gap,
    ctx,
    fontSize,
    fontStyles,
    diamondImage,
    iconPadding,
    addSeparator
  );

  const totalFrames = Math.ceil(contentWidth / scrollSpeed);

  for (let i = 0; i < totalFrames; i++) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scrollPosition = -(i * scrollSpeed) % contentWidth;

    // Get the vertical offset from the user input
    const verticalOffset = parseInt(verticalOffsetInput.value, 10) || 0;
    const yPosition = canvas.height - verticalOffset;

    drawStyledTextParts({
      parts,
      ctx,
      scrollPosition,
      yPosition,
      textColor,
      fontSize,
      gap,
      fontStyles,
      diamondImage,
      iconPadding,
      contentWidth,
      addSeparator,
      canvasWidth: canvas.width,
    });

    gif.addFrame(ctx, {
      copy: true,
      delay: frameDelay,
    });
  }

  gif.on("finished", (blob) => {
    handleGifFinished(blob, text, colorway);
  });

  try {
    gif.render();
  } catch (error) {
    console.error("Error rendering GIF:", error);
    hideLoadingIndicator();
    alert("Failed to render GIF. Please try again.");
  }
}

// Get selected colorway
function getSelectedColorway() {
  const selectedRadio = document.querySelector(
    'input[name="colorway"]:checked'
  );
  return selectedRadio ? selectedRadio.value : "black-white";
}

// Get colors based on selected colorway
function getColorwayColors(colorway) {
  const colorways = {
    "black-white": { bgColor: "#2F2F2F", textColor: "#FFFFFF" },
    "yellow-black": { bgColor: "#FFDC00", textColor: "#2F2F2F" },
    "black-white-bg": { bgColor: "#FFFFFF", textColor: "#2F2F2F" },
    "black-teal": { bgColor: "#62BAB7", textColor: "#2F2F2F" },
    "yellow-on-black": { bgColor: "#2F2F2F", textColor: "#FFDC00" },
  };
  return colorways[colorway] || colorways["black-white"];
}

// Get separation settings
function getSeparationSettings(separationValue) {
  let gap = 0;
  let addSeparator = false;

  if (separationValue === "gap") {
    gap = 20;
  } else if (separationValue === "icon") {
    addSeparator = true;
  }

  return { gap, addSeparator };
}

// Calculate content width
function calculateContentWidth(
  parts,
  gap,
  ctx,
  fontSize,
  fontStyles,
  diamondImage,
  iconPadding,
  addSeparator
) {
  let contentWidth = 0;
  const scaledDiamondHeight = fontSize * 0.8;
  const scaledDiamondWidth =
    (diamondImage.width / diamondImage.height) * scaledDiamondHeight;

  // Calculate width of the text parts
  parts.forEach((part) => {
    const { family } = fontStyles[part.style];
    ctx.font = `${fontSize}px ${family}`;
    const textWidth = ctx.measureText(part.text).width;
    contentWidth += textWidth;
  });

  // Add gap or separator width
  if (addSeparator) {
    contentWidth += scaledDiamondWidth + 2 * iconPadding;
  } else {
    contentWidth += gap;
  }

  return contentWidth;
}

// Draw styled text parts on the canvas
function drawStyledTextParts(params) {
  const {
    parts,
    ctx,
    scrollPosition,
    yPosition,
    textColor,
    fontSize,
    gap,
    fontStyles,
    diamondImage,
    iconPadding,
    contentWidth,
    addSeparator,
    canvasWidth,
  } = params;

  let currentX = scrollPosition;

  const scaledDiamondHeight = fontSize * 0.8;
  const scaledDiamondWidth =
    (diamondImage.width / diamondImage.height) * scaledDiamondHeight;

  // Ensure the content repeats enough times to fill the canvas
  while (currentX < canvasWidth) {
    let tempX = currentX;

    // Draw the text parts
    parts.forEach((part) => {
      ctx.fillStyle = textColor;
      const { family } = fontStyles[part.style];
      ctx.font = `${fontSize}px ${family}`;
      ctx.fillText(part.text, tempX, yPosition);
      tempX += ctx.measureText(part.text).width;
    });

    // Add gap or separator
    if (addSeparator) {
      tempX += iconPadding;
      drawSeparator(
        ctx,
        tempX,
        yPosition,
        scaledDiamondWidth,
        scaledDiamondHeight,
        textColor,
        diamondImage
      );
      tempX += scaledDiamondWidth + iconPadding;
    } else {
      tempX += gap;
    }

    currentX += contentWidth;
  }
}

// Draw separator icon
function drawSeparator(ctx, x, y, width, height, color, image) {
  ctx.fillStyle = color;
  ctx.drawImage(image, x, y - height, width, height);
}

// Handle GIF generation completion
function handleGifFinished(blob, text, colorway) {
  const url = URL.createObjectURL(blob);
  gifPreview.innerHTML = `<img width="640" height="50" src="${url}" alt="Generated GIF">`;
  downloadLink.href = url;
  downloadLink.style.display = "block";

  // Add or remove border based on background color
  gifPreview.className = "";
  const { bgColor } = getColorwayColors(colorway);
  if (bgColor === "#FFFFFF") {
    gifPreview.classList.add("white-background");
  }

  // Display file size
  const fileSizeInKB = (blob.size / 1024).toFixed(2);
  fileSizeValue.textContent = `${fileSizeInKB} KB`;

  // Check if file size exceeds 300 KB
  if (blob.size > MAX_FILE_SIZE) {
    fileSizeValue.style.color = "red";
    fileSizeValue.title =
      "The file size exceeds the recommended limit of 300 KB.";
  } else {
    fileSizeValue.style.color = "";
    fileSizeValue.title = "";
  }

  fileSizeDisplay.style.display = "block";

  // Set download filename
  const fileName = generateFileName(text, colorway);
  downloadLink.download = fileName;

  // Hide loading indicator
  hideLoadingIndicator();
}

// Generate file name for download
function generateFileName(text, colorway) {
  const colorName = colorway.replace("-", "_");
  const sanitizedText = text.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
  return `${sanitizedText}_${colorName}_${canvas.width}w_${canvas.height}h.gif`;
}

// Reset preview area
function resetPreview() {
  gifPreview.innerHTML = "";
  downloadLink.style.display = "none";
  fileSizeDisplay.style.display = "none";
}

// Show loading indicator
function showLoadingIndicator() {
  loadingIndicator.style.display = "block";
  resetPreview();
}

// Hide loading indicator
function hideLoadingIndicator() {
  loadingIndicator.style.display = "none";
}

// Initial render
if (diamondImageLoaded && fontsLoaded) {
  renderGIF(inputText.value.trim().toUpperCase());
} else {
  loadResourcesAndRenderGIF();
}
