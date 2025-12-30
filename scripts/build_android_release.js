import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to run shell commands
function runCommand(command) {
    console.log(`\n> ${command}`);
    try {
        execSync(command, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    } catch (error) {
        console.error(`Error executing command: ${command}`);
        process.exit(1);
    }
}

// Main function
function main() {
    const newVersion = process.argv[2];

    if (!newVersion) {
        console.error('Error: Please provide a version number (e.g., node scripts/build_android_release.js 1.14.0)');
        process.exit(1);
    }

    console.log(`Starting release process for version: ${newVersion}`);

    const rootDir = path.join(__dirname, '..');
    const packageJsonPath = path.join(rootDir, 'package.json');
    const gradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');

    // 1. Update package.json
    console.log('Updating package.json...');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4));
    console.log(`Updated package.json version to ${newVersion}`);

    // 2. Update android/app/build.gradle
    console.log('Updating build.gradle...');
    let gradleContent = fs.readFileSync(gradlePath, 'utf8');

    // Update versionName "1.13.0" -> "newVersion"
    const versionNameRegex = /versionName\s+"(.*?)"/;
    if (versionNameRegex.test(gradleContent)) {
        gradleContent = gradleContent.replace(versionNameRegex, `versionName "${newVersion}"`);
        console.log(`Updated versionName to ${newVersion}`);
    } else {
        console.error('Could not find versionName in build.gradle');
        process.exit(1);
    }

    // Update versionCode 20 -> 21
    const versionCodeRegex = /versionCode\s+(\d+)/;
    const match = gradleContent.match(versionCodeRegex);
    if (match) {
        const currentCode = parseInt(match[1], 10);
        const newCode = currentCode + 1;
        gradleContent = gradleContent.replace(versionCodeRegex, `versionCode ${newCode}`);
        console.log(`Updated versionCode from ${currentCode} to ${newCode}`);
    } else {
        console.error('Could not find versionCode in build.gradle');
        process.exit(1);
    }

    fs.writeFileSync(gradlePath, gradleContent, 'utf8');

    // 3. Run Build
    console.log('Building web project...');
    runCommand('npm run build');

    // 4. Sync Android
    console.log('Syncing to Android...');
    runCommand('npx cap sync android');

    console.log('\n-----------------------------------------------------------');
    console.log(`SUCCESS! Version ${newVersion} built and synced.`);
    console.log('You can now open Android Studio and run the app.');
    console.log('-----------------------------------------------------------');
}

main();
