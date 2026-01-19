const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/panels/officials/OfficialCard.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to LF
content = content.replace(/\r\n/g, '\n');

// The block we just added (Satisfaction Indicator)
const satisfactionBlock = `
                                {isStanceSatisfied !== null && !isCandidate && (
                                    <span className={\`inline-flex items-center gap-0.5 px-1 py-px rounded text-[8px] font-medium flex-shrink-0 \${
                                        isStanceSatisfied
                                            ? 'bg-green-900/60 text-green-400 border border-green-700/60'
                                            : 'bg-red-900/60 text-red-400 border border-red-700/60'
                                    }\`} title={isStanceSatisfied ? '政治主张已满足' : '政治主张未满足'}>
                                        <Icon name={isStanceSatisfied ? 'Check' : 'X'} size={8} />
                                        {isStanceSatisfied ? '主张满足' : '主张未满'}
                                    </span>
                                )}`;

// The new block to append (Stance Name)
const stanceNameBlock = `
                                {stance?.name && (
                                    <span className="text-[9px] text-gray-300 font-bold ml-1 truncate max-w-[80px]" title={stance.description}>
                                        {stance.name}
                                    </span>
                                )}`;

// The script logic needs to find the satisfactionBlock and append the stanceNameBlock.
// However, the whitespace in satisfactionBlock string above might not match exactly due to indentation variations in my previous script vs what works here.
// But I controlled the indentation in previous script.

// The text content:
const searchTarget = `title={isStanceSatisfied ? '政治主张已满足' : '政治主张未满足'}>
                                        <Icon name={isStanceSatisfied ? 'Check' : 'X'} size={8} />
                                        {isStanceSatisfied ? '主张满足' : '主张未满'}
                                    </span>
                                )}`;

// Actually, replacing by unique substring is safer.
// I will look for the closing of the satisfaction block `)}` and insert after it, IF it follows the satisfication block content.

// Search string that is unique enough:
const uniquePart = `{isStanceSatisfied ? '主张满足' : '主张未满'}
                                    </span>
                                )}`;

if (content.includes(uniquePart)) {
    console.log('Found targets, applying changes...');
    // We expect 2 occurrences (Compact and Expanded)
    // We replace them both.
    const newContent = content.split(uniquePart).join(uniquePart + stanceNameBlock);

    // We also need to fix indentation for the second line of split/join?
    // The stanceNameBlock starts with a newline and spaces.
    // It should be fine.

    fs.writeFileSync(filePath, newContent);
    console.log('File updated successfully.');
} else {
    console.log('Target block not found. Indentation might be mismatched.');
    // Debug
    const idx = content.indexOf("主张满足");
    if (idx > 0) console.log(content.substring(idx - 50, idx + 200));
}
