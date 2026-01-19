const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/panels/officials/OfficialCard.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const marker = "'主张未满'";
const stanceNameBlock = `
                                    {stance?.name && (
                                        <span className="text-[9px] text-gray-300 font-bold ml-1 truncate max-w-[80px]" title={stance.description}>
                                            {stance.name}
                                        </span>
                                    )}`;

let lastIndex = 0;
let newContentParts = [];
let searchIndex = content.indexOf(marker);

while (searchIndex !== -1) {
    // Find the closing brace of the JSX expression containing this marker.
    // The expression likely ends with `)}`.
    const closingIndex = content.indexOf(')}', searchIndex);

    if (closingIndex !== -1) {
        // Append everything up to the closing brace + 2 characters (to include ')}')
        newContentParts.push(content.substring(lastIndex, closingIndex + 2));
        // Append our new block
        newContentParts.push(stanceNameBlock);

        lastIndex = closingIndex + 2;
        searchIndex = content.indexOf(marker, lastIndex);
    } else {
        break;
    }
}

newContentParts.push(content.substring(lastIndex));
const finalContent = newContentParts.join('');

if (newContentParts.length > 1) {
    fs.writeFileSync(filePath, finalContent);
    console.log('File updated successfully.');
} else {
    console.log('Marker not found.');
}
