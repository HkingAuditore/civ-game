const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/panels/officials/OfficialCard.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// The replacement UI for the indicator
const indicatorCode = `
                                {isStanceSatisfied !== null && !isCandidate && (
                                    <span className={\`inline-flex items-center gap-0.5 px-1 py-px rounded text-[8px] font-medium flex-shrink-0 \${
                                        isStanceSatisfied
                                            ? 'bg-green-900/60 text-green-400 border border-green-700/60'
                                            : 'bg-red-900/60 text-red-400 border border-red-700/60'
                                    }\`} title={isStanceSatisfied ? '政治主张已满足' : '政治主张未满足'}>
                                        <Icon name={isStanceSatisfied ? 'Check' : 'X'} size={8} />
                                        {isStanceSatisfied ? '主张满足' : '主张未满'}
                                    </span>
                                )}
`;

// 1. Expanded view (lines ~626-628) - 32 spaces indentation for Icon
const targetExpanded = `                                <Icon name={stanceColors.icon} size={8} />
                                {stanceColors.label}
                            </span>`;

const replacementExpanded = `                                <Icon name={stanceColors.icon} size={8} />
                                {stanceColors.label}
                            </span>` + indicatorCode.replace(/\n/g, '\n                            '); // Adjust indentation baseline

// 2. Compact view (lines ~445-447) - 36 spaces indentation for Icon
const targetCompact = `                                    <Icon name={stanceColors.icon} size={8} />
                                    {stanceColors.label}
                                </span>`;

// Note: We need to wrap the compact view contents in a Fragment because it's inside {stance && (...)}
// But wait, if I just append it after the span, it's valid JSX inside {stance && ( <span/> <new_span/> )} -> NO, needs fragment.
// So I will replace the wrapper too or use a fragment.
// The original compact code:
// {stance && (
//     <span ...>
//         ...
//     </span>
// )}
//
// New code:
// {stance && (
//     <>
//         <span ...>
//             ...
//         </span>
//         {indicator}
//     </>
// )}

// Let's try to match the whole block for Compact view to be safe.
const targetCompactFull = `                            {stance && (
                                <span className={\`inline-flex items-center gap-0.5 px-1 py-px rounded text-[8px] font-medium \${stanceColors.bg} \${stanceColors.text} border \${stanceColors.border} flex-shrink-0\`}>
                                    <Icon name={stanceColors.icon} size={8} />
                                    {stanceColors.label}
                                </span>
                            )}`;

const replacementCompactFull = `                            {stance && (
                                <>
                                    <span className={\`inline-flex items-center gap-0.5 px-1 py-px rounded text-[8px] font-medium \${stanceColors.bg} \${stanceColors.text} border \${stanceColors.border} flex-shrink-0\`}>
                                        <Icon name={stanceColors.icon} size={8} />
                                        {stanceColors.label}
                                    </span>
                                    {isStanceSatisfied !== null && !isCandidate && (
                                        <span className={\`inline-flex items-center gap-0.5 px-1 py-px rounded text-[8px] font-medium flex-shrink-0 \${
                                            isStanceSatisfied
                                                ? 'bg-green-900/60 text-green-400 border border-green-700/60'
                                                : 'bg-red-900/60 text-red-400 border border-red-700/60'
                                        }\`} title={isStanceSatisfied ? '政治主张已满足' : '政治主张未满足'}>
                                            <Icon name={isStanceSatisfied ? 'Check' : 'X'} size={8} />
                                            {isStanceSatisfied ? '主张满足' : '主张未满'}
                                        </span>
                                    )}
                                </>
                            )}`;

// Apply Expanded Replacement
// Identify indentation of the indicatorCode for Expanded view
const indicatorExpanded = `
                            {isStanceSatisfied !== null && !isCandidate && (
                                <span className={\`inline-flex items-center gap-0.5 px-1 py-px rounded text-[8px] font-medium flex-shrink-0 \${
                                    isStanceSatisfied
                                        ? 'bg-green-900/60 text-green-400 border border-green-700/60'
                                        : 'bg-red-900/60 text-red-400 border border-red-700/60'
                                }\`} title={isStanceSatisfied ? '政治主张已满足' : '政治主张未满足'}>
                                    <Icon name={isStanceSatisfied ? 'Check' : 'X'} size={8} />
                                    {isStanceSatisfied ? '已满足' : '未满足'}
                                </span>
                            )}`;

if (content.includes(targetExpanded)) {
    console.log('Found Expanded target');
    content = content.replace(targetExpanded, targetExpanded + indicatorExpanded);
} else {
    console.log('Expanded target not found. Checking substrings...');
    // Debugging info
    // console.log(content.substring(content.indexOf('stanceColors.icon') - 50, content.indexOf('stanceColors.icon') + 100));
}

if (content.includes(targetCompactFull)) {
    console.log('Found Compact target');
    content = content.replace(targetCompactFull, replacementCompactFull);
} else {
    console.log('Compact target not found');
}

fs.writeFileSync(filePath, content);
console.log('File updated');
