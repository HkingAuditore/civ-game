#!/usr/bin/env python3
"""
Event Image Generator Script
Reads prompts from event_prompts.md and generates images using OpenAI DALL-E API.
"""

import os
import re
import time
import argparse
import requests
from pathlib import Path
from openai import OpenAI

# Configuration
PROMPTS_FILE = Path(__file__).parent.parent / "prompts" / "event_prompts.md"
OUTPUT_DIR = Path(r"C:\Users\hkinghuang\Documents\GitHub\simple_nation_game\civ-game\public\images\events")

# Image generation settings
IMAGE_SIZE = "1792x1024"  # Closest to 16:9 aspect ratio supported by DALL-E 3
IMAGE_QUALITY = "standard"  # "standard" or "hd"
IMAGE_MODEL = "dall-e-3"


def parse_events_from_markdown(filepath: Path) -> list[dict]:
    """
    Parse event_prompts.md to extract event IDs and their corresponding prompts.
    
    Returns a list of dicts with keys: 'id', 'name', 'prompt'
    """
    events = []
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern to match event headers and their prompts
    # Example: ### 丰收之年 (`good_harvest`)
    # Followed by description and then the prompt in code block
    pattern = r'### (.+?) \(`([a-z_]+)`\)\n.*?```text\n(.+?)\n```'
    
    matches = re.findall(pattern, content, re.DOTALL)
    
    for name, event_id, prompt in matches:
        # Clean up the prompt - remove the --ar 16:9 suffix as DALL-E doesn't use it
        cleaned_prompt = prompt.strip()
        if cleaned_prompt.endswith('--ar 16:9'):
            cleaned_prompt = cleaned_prompt[:-9].strip()
        
        events.append({
            'id': event_id,
            'name': name.strip(),
            'prompt': cleaned_prompt
        })
    
    return events


def generate_image(client: OpenAI, prompt: str, event_id: str, output_dir: Path) -> bool:
    """
    Generate an image using DALL-E 3 API and save it.
    
    Returns True if successful, False otherwise.
    """
    output_path = output_dir / f"{event_id}.png"
    
    # Skip if image already exists
    if output_path.exists():
        print(f"  ⏭️  Skipping {event_id} - image already exists")
        return True
    
    try:
        print(f"  🎨 Generating image for {event_id}...")
        
        response = client.images.generate(
            model=IMAGE_MODEL,
            prompt=prompt,
            size=IMAGE_SIZE,
            quality=IMAGE_QUALITY,
            n=1,
        )
        
        # Get the image URL
        image_url = response.data[0].url
        
        # Download and save the image
        image_response = requests.get(image_url, timeout=60)
        image_response.raise_for_status()
        
        with open(output_path, 'wb') as f:
            f.write(image_response.content)
        
        print(f"  ✅ Saved: {output_path}")
        return True
        
    except Exception as e:
        print(f"  ❌ Error generating {event_id}: {str(e)}")
        return False


def main():
    parser = argparse.ArgumentParser(description='Generate event images using DALL-E API')
    parser.add_argument('--api-key', type=str, help='OpenAI API Key (or set OPENAI_API_KEY env variable)')
    parser.add_argument('--start-from', type=str, help='Start from a specific event ID')
    parser.add_argument('--only', type=str, help='Generate only specific event ID(s), comma-separated')
    parser.add_argument('--delay', type=float, default=2.0, help='Delay between API calls in seconds (default: 2.0)')
    parser.add_argument('--dry-run', action='store_true', help='Parse prompts and show what would be generated without making API calls')
    parser.add_argument('--list', action='store_true', help='List all event IDs')
    
    args = parser.parse_args()
    
    # Get API key
    api_key = args.api_key or os.environ.get('OPENAI_API_KEY')
    
    if not api_key and not args.dry_run and not args.list:
        print("❌ Error: Please provide OpenAI API key via --api-key or OPENAI_API_KEY environment variable")
        return 1
    
    # Parse events from markdown
    print(f"📖 Reading prompts from: {PROMPTS_FILE}")
    events = parse_events_from_markdown(PROMPTS_FILE)
    print(f"📊 Found {len(events)} events")
    
    # List mode
    if args.list:
        print("\n📋 Event IDs:")
        for i, event in enumerate(events, 1):
            print(f"  {i:3}. {event['id']:40} - {event['name']}")
        return 0
    
    # Filter events if --only is specified
    if args.only:
        only_ids = set(args.only.split(','))
        events = [e for e in events if e['id'] in only_ids]
        print(f"📌 Filtered to {len(events)} events: {args.only}")
    
    # Skip events until start_from if specified
    if args.start_from:
        start_idx = None
        for i, event in enumerate(events):
            if event['id'] == args.start_from:
                start_idx = i
                break
        if start_idx is not None:
            events = events[start_idx:]
            print(f"⏩ Starting from {args.start_from}, {len(events)} events remaining")
        else:
            print(f"⚠️  Warning: Event ID '{args.start_from}' not found, processing all events")
    
    # Dry run mode
    if args.dry_run:
        print("\n🔍 Dry run - would generate the following images:")
        for i, event in enumerate(events, 1):
            print(f"\n  [{i}/{len(events)}] {event['id']} ({event['name']})")
            print(f"      Prompt: {event['prompt'][:100]}...")
        return 0
    
    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"📁 Output directory: {OUTPUT_DIR}")
    
    # Initialize OpenAI client
    client = OpenAI(api_key=api_key)
    
    # Generate images
    print(f"\n🚀 Starting image generation...")
    success_count = 0
    fail_count = 0
    
    for i, event in enumerate(events, 1):
        print(f"\n[{i}/{len(events)}] {event['id']} ({event['name']})")
        
        success = generate_image(client, event['prompt'], event['id'], OUTPUT_DIR)
        
        if success:
            success_count += 1
        else:
            fail_count += 1
        
        # Rate limiting - add delay between requests
        if i < len(events) and args.delay > 0:
            time.sleep(args.delay)
    
    # Summary
    print(f"\n{'='*50}")
    print(f"📊 Generation complete!")
    print(f"   ✅ Success: {success_count}")
    print(f"   ❌ Failed:  {fail_count}")
    print(f"   📁 Output:  {OUTPUT_DIR}")
    
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    exit(main())
