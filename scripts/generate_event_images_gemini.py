#!/usr/bin/env python3
"""
Event Image Generator Script using Google AI Studio (Gemini 2.5 Flash) API.
Reads prompts from event_prompts.md and generates images using the gemini-2.5-flash-image model.
"""

import sys
import os
import re
import time
import argparse
import base64
import requests
import json
from pathlib import Path

# Force UTF-8 output for Windows consoles
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')


# Configuration
# Resolving paths relative to this script
SCRIPT_DIR = Path(__file__).parent.resolve()
PROMPTS_FILE = SCRIPT_DIR.parent / "prompts" / "event_prompts.md"
DEFAULT_OUTPUT_DIR = SCRIPT_DIR.parent / "public" / "images" / "events"

# Image generation settings
DEFAULT_MODEL = "gemini-2.5-flash-image"

def parse_events_from_markdown(filepath: Path) -> list:
    """
    Parse event_prompts.md to extract event IDs and their corresponding prompts.
    
    Returns a list of dicts with keys: 'id', 'name', 'prompt'
    """
    events = []
    
    if not filepath.exists():
        print(f"❌ Error: Prompts file not found at {filepath}")
        return []

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern to match event headers and their prompts
    # Format:
    # ### Title (`id`)
    # ... description ...
    # ```text
    # Prompt...
    # ```
    # Using non-greedy match for content between header and code block
    pattern = r'###\s+(.+?)\s+\(`([a-zA-Z0-9_]+)`\).*?```text\n(.+?)\n```'
    
    matches = re.findall(pattern, content, re.DOTALL)
    
    for name, event_id, prompt in matches:
        # Clean up the prompt
        cleaned_prompt = prompt.strip()
        
        events.append({
            'id': event_id,
            'name': name.strip(),
            'prompt': cleaned_prompt
        })
    
    return events


def generate_image(api_key: str, prompt: str, event_id: str, output_dir: Path, model: str) -> bool:
    """
    Generate an image using Gemini API.
    
    Returns True if successful, False otherwise.
    """
    # Ensure filename is safe
    safe_id = "".join([c for c in event_id if c.isalnum() or c in ('_', '-')])
    output_path = output_dir / f"{safe_id}.png"
    
    # Skip if image already exists
    if output_path.exists():
        print(f"  ⏭️  Skipping {event_id} - image already exists")
        return True
    
    print(f"  🎨 Generating image for {event_id}...")
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    
    payload = {
        "contents": [{
            "parts": [{
                "text": prompt
            }]
        }],
        "generationConfig": {
            "responseModalities": ["IMAGE"] 
        }
    }
    
    headers = {"Content-Type": "application/json"}
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=60)
        
        if response.status_code != 200:
            try:
                error_info = response.json()
            except:
                error_info = response.text
                
            print(f"  ❌ Error {response.status_code}: {error_info}")
            return False
            
        result = response.json()
        
        # Check for candidates
        candidates = result.get("candidates", [])
        if not candidates:
            print(f"  ⚠️  No candidates returned from API.")
            return False
            
        # Extract image data
        # For 'generateContent' with image modality, it usually returns inline data in the candidates
        parts = candidates[0].get("content", {}).get("parts", [])
        image_data = None
        
        for part in parts:
            if "inlineData" in part:
               image_data = base64.b64decode(part["inlineData"]["data"])
               break
        
        if not image_data:
             print(f"  ⚠️  No image data found in response.")
             return False

        # Save image
        with open(output_path, 'wb') as f:
            f.write(image_data)
            
        print(f"  ✅ Saved: {output_path.name}")
        return True

    except Exception as e:
        print(f"  ❌ Exception: {str(e)}")
        return False


def main():
    parser = argparse.ArgumentParser(description='Generate event images using Gemini API (gemini-2.5-flash-image)')
    parser.add_argument('--api-key', type=str, help='Google AI Studio API Key')
    parser.add_argument('--dry-run', action='store_true', help='Do not call API, just list events')
    parser.add_argument('--only', type=str, help='Comma separated list of event IDs to process')
    parser.add_argument('--model', type=str, default=DEFAULT_MODEL, help=f'Model name (default: {DEFAULT_MODEL})')
    
    args = parser.parse_args()
    
    # Resolve API Key
    api_key = args.api_key or os.environ.get('GOOGLE_API_KEY')
    if not api_key:
        print("❌ Error: API Key is required. Set GOOGLE_API_KEY env var or pass --api-key")
        print("Usage: python generate_event_images_gemini.py --api-key YOUR_KEY")
        return
        
    # Ensure output directory exists
    if not DEFAULT_OUTPUT_DIR.exists():
        DEFAULT_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        print(f"📁 Created output directory: {DEFAULT_OUTPUT_DIR}")
        
    # Parse Prompts
    print(f"📖 Reading prompts from {PROMPTS_FILE}...")
    events = parse_events_from_markdown(PROMPTS_FILE)
    print(f"🔍 Found {len(events)} events.")
    
    if len(events) == 0:
        print("⚠️  No events found. Please check the prompt file format.")
        return

    if args.only:
        target_ids = [x.strip() for x in args.only.split(',')]
        events = [e for e in events if e['id'] in target_ids]
        print(f"🎯 Filtered to {len(events)} events: {target_ids}")

    if args.dry_run:
        print("\n[DRY RUN] Would generate the following:")
        for e in events:
            print(f"  - {e['id']} ({e['name']}): {e['prompt'][:60]}...")
        return

    # Process
    print(f"\n🚀 Starting generation using model: {args.model}")
    print(f"📂 Output directory: {DEFAULT_OUTPUT_DIR}")
    
    success_count = 0
    total = len(events)
    
    for i, event in enumerate(events):
        print(f"\n[{i+1}/{total}] Processing {event['id']}...")
        if generate_image(api_key, event['prompt'], event['id'], DEFAULT_OUTPUT_DIR, args.model):
            success_count += 1
        
        # Simple rate limiting to avoid hitting quotas too hard
        if i < total - 1:
            time.sleep(2) 
        
    print(f"\n✨ Done! {success_count}/{total} images generated/verified.")


if __name__ == "__main__":
    main()
