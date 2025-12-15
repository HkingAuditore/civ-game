#!/usr/bin/env python3
"""
Event Image Generator using Venus Platform (OpenAI-compatible API)
Supports multiple image generation models:
  - gemini-3-pro-image (Nano Banana Pro) - Recommended
  - gemini-2.5-flash-image (Nano Banana)
"""

import os
import sys
import re
import json
import time
import base64
import argparse
import requests
from pathlib import Path

# Configuration
VENUS_API_URL = "http://v2.open.venus.oa.com/llmproxy/v1/chat/completions"
DEFAULT_MODEL = "gemini-3-pro-image"  # Nano Banana Pro - recommended
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "images" / "events"
PROMPTS_FILE = Path(__file__).parent.parent / "prompts" / "event_prompts.md"

# Available image generation models on Venus
AVAILABLE_MODELS = {
    "gemini-3-pro-image": "Nano Banana Pro 🍌🍌 (Google Gemini 3 Pro Image) - Recommended",
    "gemini-2.5-flash-image": "Nano Banana 🍌 (Google Gemini 2.5 Flash Image)",
}


def parse_event_prompts(filepath: Path) -> dict:
    """Parse event_prompts.md and extract event IDs with their prompts."""
    events = {}
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern to match each event section
    # Format: ### 事件名称 (`event_id`)
    # Prompt is in ```text ... ``` block
    pattern = r'### (.+?) \(`([a-z0-9_]+)`\).*?```(?:text)?\n(.*?)```'
    matches = re.findall(pattern, content, re.DOTALL)
    
    for name, event_id, prompt in matches:
        # Clean up the prompt
        prompt = prompt.strip()
        events[event_id] = {
            'name': name.strip(),
            'prompt': prompt
        }
    
    return events


def generate_image(api_token: str, prompt: str, event_id: str, model: str = DEFAULT_MODEL, aspect_ratio: str = "16:9") -> bytes | None:
    """Generate an image using Venus API with specified model."""
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_token}"
    }
    
    # Build the request payload (OpenAI-compatible format)
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": f"Generate an image based on this description:\n\n{prompt}"
            }
        ],
        "aspect_ratio": aspect_ratio,  # Venus supports aspect_ratio parameter
        "max_tokens": 4096
    }
    
    try:
        response = requests.post(
            VENUS_API_URL,
            headers=headers,
            json=payload,
            timeout=120
        )
        
        if response.status_code != 200:
            error_msg = response.text
            try:
                error_data = response.json()
                error_msg = json.dumps(error_data, ensure_ascii=False)
            except:
                pass
            print(f"  ❌ Error generating {event_id}: {response.status_code} {response.reason}. {error_msg}")
            return None
        
        result = response.json()
        
        # Parse the response to extract image data
        # The response format follows OpenAI structure
        choices = result.get("choices", [])
        if not choices:
            print(f"  ❌ No choices in response for {event_id}")
            return None
        
        message = choices[0].get("message", {})
        content = message.get("content")
        
        # Content might be a list (multimodal) or string
        if isinstance(content, list):
            # Look for image content in the list
            for item in content:
                if isinstance(item, dict):
                    # Check for venus_multimodal_url or base64 image
                    if item.get("type") == "venus_multimodal_url":
                        url = item.get("venus_multimodal_url", {}).get("url", "")
                        if url.startswith("data:image"):
                            # Extract base64 data
                            match = re.match(r'data:image/\w+;base64,(.+)', url)
                            if match:
                                return base64.b64decode(match.group(1))
                        else:
                            # It's a URL, download it
                            img_response = requests.get(url, timeout=60)
                            if img_response.status_code == 200:
                                return img_response.content
                    elif item.get("type") == "image_url":
                        url = item.get("image_url", {}).get("url", "")
                        if url.startswith("data:image"):
                            match = re.match(r'data:image/\w+;base64,(.+)', url)
                            if match:
                                return base64.b64decode(match.group(1))
                        else:
                            img_response = requests.get(url, timeout=60)
                            if img_response.status_code == 200:
                                return img_response.content
        elif isinstance(content, str):
            # Check if it's base64 encoded image data
            if content.startswith("data:image"):
                match = re.match(r'data:image/\w+;base64,(.+)', content)
                if match:
                    return base64.b64decode(match.group(1))
            # Check if response contains a URL
            url_match = re.search(r'https?://[^\s\'"]+\.(png|jpg|jpeg|webp)', content, re.IGNORECASE)
            if url_match:
                img_response = requests.get(url_match.group(0), timeout=60)
                if img_response.status_code == 200:
                    return img_response.content
        
        # If we get here, try to find image data in raw response
        print(f"  ⚠️  Could not extract image from response for {event_id}")
        print(f"  Response structure: {json.dumps(result, ensure_ascii=False, indent=2)[:500]}...")
        return None
        
    except requests.exceptions.Timeout:
        print(f"  ❌ Timeout generating {event_id}")
        return None
    except Exception as e:
        print(f"  ❌ Exception generating {event_id}: {str(e)}")
        return None


def save_image(image_data: bytes, event_id: str, output_dir: Path) -> bool:
    """Save image data to file."""
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{event_id}.png"
    
    try:
        with open(output_path, 'wb') as f:
            f.write(image_data)
        return True
    except Exception as e:
        print(f"  ❌ Error saving {event_id}: {str(e)}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Generate event images using Venus Platform API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Available models:
  gemini-3-pro-image      Nano Banana Pro 🍌🍌 (Recommended)
  gemini-2.5-flash-image  Nano Banana 🍌

Examples:
  %(prog)s YOUR_TOKEN --list
  %(prog)s YOUR_TOKEN --dry-run
  %(prog)s YOUR_TOKEN --only stone_age_elder_council
  %(prog)s YOUR_TOKEN --model gemini-3-pro-image
"""
    )
    parser.add_argument(
        "--api-key", "-k",
        help="Venus API token (or set VENUS_API_KEY env var)",
        default=os.environ.get("VENUS_API_KEY", "")
    )
    parser.add_argument(
        "--model", "-m",
        default=DEFAULT_MODEL,
        choices=list(AVAILABLE_MODELS.keys()),
        help=f"Model to use for image generation (default: {DEFAULT_MODEL})"
    )
    parser.add_argument(
        "--list-models",
        action="store_true",
        help="List available image generation models"
    )
    parser.add_argument(
        "--dry-run", "-n",
        action="store_true",
        help="List events without generating images"
    )
    parser.add_argument(
        "--list", "-l",
        action="store_true",
        help="List all event IDs"
    )
    parser.add_argument(
        "--only", "-o",
        help="Only generate specified events (comma-separated IDs)"
    )
    parser.add_argument(
        "--start-from", "-s",
        help="Start from specified event ID (for resuming)"
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
        "--skip-existing",
        action="store_true",
        default=True,
        help="Skip events that already have images (default: True)"
    )
    parser.add_argument(
        "--force", "-f",
        action="store_true",
        help="Force regenerate even if image exists"
    )
    
    args = parser.parse_args()
    
    # List models mode
    if args.list_models:
        print("\n🤖 Available image generation models:")
        for model_id, description in AVAILABLE_MODELS.items():
            marker = " (default)" if model_id == DEFAULT_MODEL else ""
            print(f"  • {model_id}{marker}")
            print(f"    {description}")
        print("\nNote: You need permission to use these models. Apply at:")
        print("  https://iwiki.woa.com/p/4009051062")
        return
    
    # Check API key
    api_key = args.api_key
    if not api_key and not args.list and not args.dry_run:
        print("❌ Error: API key required. Use --api-key or set VENUS_API_KEY env var")
        print("\nUsage:")
        print("  python generate_event_images_venus.py --api-key YOUR_TOKEN")
        print("  or")
        print("  set VENUS_API_KEY=YOUR_TOKEN")
        print("  python generate_event_images_venus.py")
        sys.exit(1)
    
    # Parse events
    print(f"📖 Reading prompts from {PROMPTS_FILE}...")
    events = parse_event_prompts(PROMPTS_FILE)
    print(f"✅ Found {len(events)} events")
    
    # List mode
    if args.list:
        print("\n📋 Event IDs:")
        for i, event_id in enumerate(events.keys(), 1):
            name = events[event_id]['name']
            print(f"  {i:3}. {event_id} ({name})")
        return
    
    # Filter events if --only specified
    if args.only:
        only_ids = [x.strip() for x in args.only.split(',')]
        events = {k: v for k, v in events.items() if k in only_ids}
        if not events:
            print(f"❌ No matching events found for: {args.only}")
            sys.exit(1)
        print(f"🎯 Filtered to {len(events)} events: {', '.join(events.keys())}")
    
    # Start from specified event
    if args.start_from:
        event_ids = list(events.keys())
        if args.start_from in event_ids:
            start_idx = event_ids.index(args.start_from)
            events = {k: events[k] for k in event_ids[start_idx:]}
            print(f"⏩ Starting from {args.start_from} ({len(events)} events remaining)")
        else:
            print(f"❌ Event ID not found: {args.start_from}")
            sys.exit(1)
    
    # Check existing images
    if not args.force:
        existing = set()
        if OUTPUT_DIR.exists():
            existing = {f.stem for f in OUTPUT_DIR.glob("*.png")}
        to_generate = {k: v for k, v in events.items() if k not in existing}
        skipped = len(events) - len(to_generate)
        if skipped > 0:
            print(f"⏭️  Skipping {skipped} existing images")
        events = to_generate
    
    if not events:
        print("✅ All images already exist!")
        return
    
    # Dry run mode
    if args.dry_run:
        print(f"\n🔍 Dry run - would generate {len(events)} images:")
        for i, (event_id, info) in enumerate(events.items(), 1):
            print(f"\n[{i}/{len(events)}] {event_id} ({info['name']})")
            print(f"  Prompt: {info['prompt'][:100]}...")
        return
    
    # Generate images
    print(f"\n🎨 Generating {len(events)} images...")
    print(f"📁 Output directory: {OUTPUT_DIR}")
    print(f"🤖 Model: {args.model} ({AVAILABLE_MODELS.get(args.model, 'Unknown')})")
    print(f"📐 Aspect ratio: {args.aspect_ratio}")
    print()
    
    success_count = 0
    fail_count = 0
    
    for i, (event_id, info) in enumerate(events.items(), 1):
        print(f"[{i}/{len(events)}] {event_id} ({info['name']})")
        print(f"  🎨 Generating image for {event_id}...")
        
        image_data = generate_image(
            api_key, 
            info['prompt'], 
            event_id,
            model=args.model,
            aspect_ratio=args.aspect_ratio
        )
        
        if image_data:
            if save_image(image_data, event_id, OUTPUT_DIR):
                print(f"  ✅ Saved {event_id}.png")
                success_count += 1
            else:
                fail_count += 1
        else:
            fail_count += 1
        
        # Delay between requests
        if i < len(events):
            time.sleep(args.delay)
    
    # Summary
    print(f"\n{'='*50}")
    print(f"📊 Summary:")
    print(f"  ✅ Success: {success_count}")
    print(f"  ❌ Failed: {fail_count}")
    print(f"  📁 Output: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
