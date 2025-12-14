
const fs = require('fs');
const path = require('path');

const eventDir = path.join(__dirname, '../src/config/events');
const outputDesc = path.join(__dirname, 'extracted_events.json');

const filesToRead = [
    'baseEvents.js',
    'classConflictEvents.js',
    'economicEvents.js',
    'epochEvents.js',
    'staticDiplomaticEvents.js'
];

let allEvents = [];

filesToRead.forEach(file => {
    const filePath = path.join(eventDir, file);
    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filePath}`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    
    // Split by `id:` which usually starts a new event definition
    const chunks = content.split(/\s+id:\s*/);
    
    for (let i = 1; i < chunks.length; i++) {
        let chunk = chunks[i];
        
        // Extract ID
        let idMatch = chunk.match(/^['"`]([^'"`]+)['"`]/);
        if (!idMatch) continue;
        let id = idMatch[1];
        
        // Extract Name
        let nameMatch = chunk.match(/name:\s*['"`]([^'"`]+)['"`]/);
        let name = nameMatch ? nameMatch[1] : 'Unknown';
        
        // Extract Description
        let desc = 'No description';
        const descTag = 'description:';
        let descIdx = chunk.indexOf(descTag);
        if (descIdx !== -1) {
            let valueStart = descIdx + descTag.length;
            while (chunk[valueStart] && /\s/.test(chunk[valueStart])) valueStart++;
            
            const quoteChar = chunk[valueStart];
            if (['\'', '"', '`'].includes(quoteChar)) {
                let valueEnd = valueStart + 1;
                while (valueEnd < chunk.length) {
                    if (chunk[valueEnd] === quoteChar && chunk[valueEnd-1] !== '\\') {
                        break;
                    }
                    valueEnd++;
                }
                desc = chunk.substring(valueStart + 1, valueEnd);
            }
        }
        
        // Cleanup description: remove newlines and extra spaces
        desc = desc.replace(/\s+/g, ' ').trim();

        // Extract Trigger Conditions (Min/Max Epoch)
        let minEpoch = null;
        let maxEpoch = null;
        
        let triggers = chunk.match(/triggerConditions:\s*{([^}]+)}/);
        if (triggers) {
            let triggerContent = triggers[1];
            let minEMatch = triggerContent.match(/minEpoch:\s*(\d+)/);
            let maxEMatch = triggerContent.match(/maxEpoch:\s*(\d+)/);
            if (minEMatch) minEpoch = parseInt(minEMatch[1]);
            if (maxEMatch) maxEpoch = parseInt(maxEMatch[1]);
        }
        
        allEvents.push({
            source: file,
            id,
            name,
            description: desc,
            minEpoch,
            maxEpoch
        });
    }
});

console.log(`Extracted ${allEvents.length} events.`);
fs.writeFileSync(outputDesc, JSON.stringify(allEvents, null, 2));
