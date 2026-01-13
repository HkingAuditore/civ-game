import time
from playwright.sync_api import sync_playwright, Page, expect

def verify_negotiation_ui(page: Page):
    # 1. Setup mobile viewport
    page.set_viewport_size({"width": 375, "height": 700})

    # 2. Go to app
    print("Navigating to app...")
    page.goto("http://localhost:3000")

    # 3. Skip Tutorial via LocalStorage
    print("Skipping tutorial...")
    page.evaluate("localStorage.setItem('tutorial_completed', 'true')")
    page.reload()

    # Wait for the app to load (wait for bottom nav)
    print("Waiting for bottom nav...")
    page.wait_for_selector("nav[role='tablist']", state="visible")

    # 4. Click "Diplomacy" tab (5th button)
    print("Clicking Diplomacy tab...")
    buttons = page.locator("nav[role='tablist'] button[role='tab']")
    expect(buttons.nth(4)).to_be_visible()
    buttons.nth(4).click()

    # 5. Wait for nation list
    print("Waiting for nation list...")
    page.wait_for_timeout(2000)

    cards = page.locator(".cursor-pointer")
    count = cards.count()
    print(f"Found {count} clickable cards")

    if count < 2:
        print("Not enough nations found.")
        page.screenshot(path="/home/jules/verification/debug_list.png")
        return

    # Click the second one (index 1)
    print("Clicking a nation...")
    cards.nth(1).click()

    # 6. Wait for Nation Detail View
    print("Waiting for Nation Detail View...")
    page.wait_for_timeout(1000)

    # Click "Diplomacy Actions" tab (2nd tab)
    print("Clicking Actions tab...")
    # Find the container with px-6 and border-b
    tabs_containers = page.locator(".px-6.border-b")
    if tabs_containers.count() > 0:
         tabs_container = tabs_containers.first
         tabs_container.locator("button").nth(1).click()
    else:
        # Fallback if class search fails, look for button with likely text even if fonts broken
        try:
            page.get_by_text("外交行动").click(timeout=1000)
        except:
             print("Could not find tabs by class or text.")
             # Maybe the header is different.
             # Let's try to click a button that contains 'Action' or similar if English?
             # Or just the 2nd button in the page body (skipping nav).
             pass

    page.wait_for_timeout(1000)

    # 7. Click Negotiation button (3rd card)
    print("Clicking Negotiation button...")
    action_cards = page.locator(".group.flex.items-start.gap-4")

    if action_cards.count() >= 3:
        action_cards.nth(2).click()
    else:
        print(f"Found only {action_cards.count()} action cards. Attempting fallback or screenshot.")
        # Check if we are actually on the actions tab?
        pass

    # 8. Wait for Dialog
    print("Waiting for Dialog...")
    page.wait_for_selector(".fixed.inset-0.z-50", state="visible")

    # Wait a bit for animation
    page.wait_for_timeout(1500)

    # 9. Screenshot
    print("Taking screenshot...")
    page.screenshot(path="/home/jules/verification/mobile_negotiation.png")
    print("Done.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_negotiation_ui(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error.png")
        finally:
            browser.close()
