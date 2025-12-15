#!/usr/bin/env python3
"""
Event Image Generator using Google GenAI SDK
Uses gemini-2.5-flash-image model for image generation

Prerequisites:
    pip install google-genai
"""

import argparse
import base64
import mimetypes
import os
import re
import sys
import time
from pathlib import Path

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("❌ Error: google-genai package not installed")
    print("   Please run: pip install google-genai")
    sys.exit(1)

# Configuration
DEFAULT_MODEL = "gemini-2.5-flash-image"
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "images" / "events"
PROMPTS_FILE = Path(__file__).parent.parent / "prompts" / "event_prompts.md"


def parse_prompts_file(file_path: Path) -> dict:
    """Parse event_prompts.md and extract event IDs, names, and prompts."""
    if not file_path.exists():
        print(f"❌ Prompts file not found: {file_path}")
        return {}
    
    content = file_path.read_text(encoding='utf-8')
    events = {}
    
    # Pattern to match: ### Event Name (`event_id`)
    # Followed by ```text or ``` block containing the prompt
    pattern = r'### (.+?) \(`([a-z0-9_]+)`\).*?```(?:text)?\n(.*?)```'
    
    matches = re.findall(pattern, content, re.DOTALL)
    
    for name, event_id, prompt in matches:
        events[event_id] = {
            'name': name.strip(),
            'prompt': prompt.strip()
        }
    
    return events


def generate_image(client, prompt: str, event_id: str, model: str, aspect_ratio: str = "16:9") -> bytes | None:
    """Generate an image using Google GenAI SDK."""
    
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=prompt),
            ],
        ),
    ]
    
    generate_content_config = types.GenerateContentConfig(
        response_modalities=["IMAGE", "TEXT"],
        image_config=types.ImageConfig(
            aspect_ratio=aspect_ratio,
        ),
    )
    
    try:
        # Use streaming to get the image
        for chunk in client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=generate_content_config,
        ):
            if (
                chunk.candidates is None
                or chunk.candidates[0].content is None
                or chunk.candidates[0].content.parts is None
            ):
                continue
            
            part = chunk.candidates[0].content.parts[0]
            if part.inline_data and part.inline_data.data:
                return part.inline_data.data
            elif hasattr(part, 'text') and part.text:
                # Model returned text instead of image
                print(f"    ℹ️  Model response: {part.text[:100]}...")
        
        return None
        
    except Exception as e:
        print(f"  ❌ Error generating {event_id}: {e}")
        return None


def main():
    print("=" * 60)
    print("  Google GenAI Event Image Generator")
    print("  Model: gemini-2.5-flash-image")
    print("=" * 60)
    
    parser = argparse.ArgumentParser(
        description="Generate event images using Google GenAI SDK",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s YOUR_API_KEY --list
  %(prog)s YOUR_API_KEY --dry-run
  %(prog)s YOUR_API_KEY --only stone_age_elder_council
  %(prog)s YOUR_API_KEY --aspect-ratio 4:3

Environment:
  GEMINI_API_KEY    Set this to avoid passing API key each time

Get your API key at:
  https://aistudio.google.com/apikey
"""
    )
    
    parser.add_argument(
        "api_key",
        nargs="?",
        default=os.environ.get("GEMINI_API_KEY", ""),
        help="Google AI API key (or set GEMINI_API_KEY env var)"
    )
    parser.add_argument(
        "--model", "-m",
        default=DEFAULT_MODEL,
        help=f"Model to use (default: {DEFAULT_MODEL})"
    )
    parser.add_argument(
        "--list", "-l",
        action="store_true",
        help="List all event IDs and exit"
    )
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="Show what would be generated without actually generating"
    )
    parser.add_argument(
        "--only", "-o",
        help="Only generate specific event IDs (comma-separated)"
    )
    parser.add_argument(
        "--start-from", "-s",
        help="Start from specified event ID"
    )
    parser.add_argument(
        "--delay", "-d",
        type=float,
        default=2.0,
        help="Delay between API calls in seconds (default: 2)"
    )
    parser.add_argument(
        "--aspect-ratio", "-a",
        default="16:9",
        help="Image aspect ratio (default: 16:9)"
    )
    parser.add_argument(
        "--force", "-f",
        action="store_true",
        help="Force regenerate even if image exists"
    )
    
    args = parser.parse_args()
    
    # Read prompts file
    print(f"\n📖 Reading prompts from {PROMPTS_FILE}...")
    events = parse_prompts_file(PROMPTS_FILE)
    print(f"✅ Found {len(events)} events")
    
    # List mode
    if args.list:
        print("\n📋 Event IDs:")
        for event_id, info in events.items():
            print(f"  • {event_id} ({info['name']})")
        return
    
    # Check API key
    api_key = args.api_key
    if not api_key and not args.dry_run:
        print("\n❌ Error: API key required")
        print("   Pass as argument or set GEMINI_API_KEY environment variable")
        print("   Get your key at: https://aistudio.google.com/apikey")
        sys.exit(1)
    
    # Filter events if --only specified
    if args.only:
        only_ids = [id.strip() for id in args.only.split(',')]
        events = {k: v for k, v in events.items() if k in only_ids}
        if not events:
            print(f"\n❌ No matching events found for: {args.only}")
            return
    
    # Start from specific event if --start-from specified
    if args.start_from:
        found = False
        new_events = {}
        for event_id, info in events.items():
            if event_id == args.start_from:
                found = True
            if found:
                new_events[event_id] = info
        if not found:
            print(f"\n❌ Event not found: {args.start_from}")
            return
        events = new_events
    
    # Dry run mode
    if args.dry_run:
        print(f"\n🔍 DRY RUN - Would generate {len(events)} images:")
        for event_id, info in events.items():
            output_path = OUTPUT_DIR / f"{event_id}.png"
            exists = "✓ exists" if output_path.exists() else "✗ missing"
            skip = " (skip)" if output_path.exists() and not args.force else ""
            print(f"  • {event_id} ({info['name']}) [{exists}]{skip}")
        return
    
    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Initialize GenAI client
    print(f"\n🔑 Initializing Google GenAI client...")
    client = genai.Client(api_key=api_key)
    
    print(f"\n🎨 Generating {len(events)} images...")
    print(f"📁 Output directory: {OUTPUT_DIR}")
    print(f"🤖 Model: {args.model}")
    print(f"📐 Aspect ratio: {args.aspect_ratio}")
    print(f"⏱️  Delay between calls: {args.delay}s")
    
    success_count = 0
    skip_count = 0
    error_count = 0
    
    for i, (event_id, info) in enumerate(events.items(), 1):
        output_path = OUTPUT_DIR / f"{event_id}.png"
        
        # Skip if already exists (unless --force)
        if output_path.exists() and not args.force:
            print(f"\n[{i}/{len(events)}] {event_id} ({info['name']})")
            print(f"  ⏭️  Skipped (already exists)")
            skip_count += 1
            continue
        
        print(f"\n[{i}/{len(events)}] {event_id} ({info['name']})")
        print(f"  🎨 Generating image for {event_id}...")
        
        image_data = generate_image(
            client,
            info['prompt'],
            event_id,
            model=args.model,
            aspect_ratio=args.aspect_ratio
        )
        
        if image_data:
            output_path.write_bytes(image_data)
            print(f"  ✅ Saved to {output_path}")
            success_count += 1
        else:
            print(f"  ❌ Failed to generate image")
            error_count += 1
        
        # Delay between calls (except for last one)
        if i < len(events) and args.delay > 0:
            time.sleep(args.delay)
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 Summary:")
    print(f"  ✅ Success: {success_count}")
    print(f"  ⏭️  Skipped: {skip_count}")
    print(f"  ❌ Errors: {error_count}")
    print("=" * 60)


if __name__ == "__main__":
    main()
