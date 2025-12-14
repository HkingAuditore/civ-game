
const fs = require('fs');
const path = require('path');

const inputJson = path.join(__dirname, 'extracted_events.json');
const outputMd = path.join('C:\\Users\\HkingAuditore\\.gemini\\antigravity\\brain\\f54d1ca7-d77d-4979-bf10-94da08278cfc', 'event_prompts.md');

if (!fs.existsSync(inputJson)) {
    console.error('Input JSON not found!');
    process.exit(1);
}

const events = JSON.parse(fs.readFileSync(inputJson, 'utf8'));

// Filter out options (items with name 'Unknown' or missing description)
// Also filter duplicate IDs to avoid repetition
const uniqueEvents = new Map();
events.forEach(e => {
    if (e.name !== 'Unknown' && e.name && e.description && e.description !== 'No description') {
        if (!uniqueEvents.has(e.id)) {
            uniqueEvents.set(e.id, e);
        }
    }
});

const sortedEvents = Array.from(uniqueEvents.values()).sort((a, b) => {
    // Sort by source file, then epoch
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return (a.minEpoch || 0) - (b.minEpoch || 0);
});

const EPOCH_NAMES = {
    0: "Stone Age",
    1: "Bronze Age",
    2: "Classical Era",
    3: "Middle Ages",
    4: "Age of Exploration",
    5: "Enlightenment Era",
    6: "Industrial Revolution",
    7: "Modern Era"
};

function getEpochContext(min, max) {
    if (min === null && max === null) return "Historical setting";
    if (min !== null) return EPOCH_NAMES[min] || "Historical setting";
    if (max !== null) return EPOCH_NAMES[max] || "Historical setting";
    return "Historical setting";
}

let mdContent = `# Event Image Generation Prompts

> [!NOTE]
> This file contains AI validation prompts for all static game events.
> **Style Guide:** Victoria 3 art style, oil painting texture, cinematic composition, highly detailed.
> **Aspect Ratio:** 16:9 (--ar 16:9)

`;

let currentSource = '';

sortedEvents.forEach(e => {
    if (e.source !== currentSource) {
        currentSource = e.source;
        mdContent += `\n## Source: ${e.source}\n\n`;
    }

    const epochContext = getEpochContext(e.minEpoch, e.maxEpoch);
    
    // Construct Prompt
    // Translate description to visual prompt is hard without AI, 
    // so we will use the description itself as the core, wrapped in style keywords.
    
    // Remove game-specific UI text like "Option 1:" from description if any
    let visualDesc = e.description.replace(/\n/g, ' ');
    
    const prompt = `A cinematic oil painting of ${e.name}, ${epochContext}. ${visualDesc} Victoria 3 art style, heavy impasto, dramatic lighting, detailed background, no text, masterpiece. --ar 16:9`;
    
    mdContent += `### ${e.name} (\`${e.id}\`)
> **Description:** ${e.description}
> **Epoch:** ${e.minEpoch ?? 'Any'} - ${e.maxEpoch ?? 'Any'}

\`\`\`text
${prompt}
\`\`\`

`;
});

// Append Generic Prompts for Dynamic Events
mdContent += `
## Dynamic & Generic Events

### War Declaration
\`\`\`text
A cinematic oil painting of a formal War Declaration. A tense diplomatic chamber, an envoy presenting a sealed scroll to a ruler. Heavy atmosphere, ominous lighting. Victoria 3 art style, detailed period costumes, dramatic shadows. --ar 16:9
\`\`\`

### Peace Treaty
\`\`\`text
A cinematic oil painting of a Peace Treaty signing. Diplomat signing a parchment on an ornate desk, flags of nations in the background. Rays of light symbolic of hope. Victoria 3 art style, rich textures. --ar 16:9
\`\`\`

### Rebellion (Generic)
\`\`\`text
A cinematic oil painting of a Rebellion Outbreak. Angry crowds gathering in a city square, holding torches and improvised banners. Chaos and smoke in the background. Victoria 3 art style, dynamic composition. --ar 16:9
\`\`\`

### Diplomatic Gift
\`\`\`text
A cinematic oil painting of a Diplomatic Gift presentation. Servants carrying chests of gold and exotic textiles to a throne room. Opulent and detailed. Victoria 3 art style. --ar 16:9
\`\`\`
`;

fs.writeFileSync(outputMd, mdContent);
console.log(`Generated prompts for ${sortedEvents.length} events.`);
