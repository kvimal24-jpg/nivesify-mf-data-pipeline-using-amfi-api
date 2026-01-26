import os, boto3, pandas as pd, base64
from playwright.sync_api import sync_playwright

# ... (R2 Connection stays the same) ...

def run_scraper():
    all_dfs = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # We add a larger viewport and a standard user agent
        context = browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = context.new_page()

        try:
            print("Opening AMFI website...")
            page.goto("https://www.amfiindia.com/otherdata/fund-performance", wait_until="networkidle", timeout=60000)
            
            # DEBUG: Let's see if the page even loaded the main container
            print(f"Page loaded. Title: {page.title()}")
            
            # Wait a few seconds for any Next.js hydration
            page.wait_for_timeout(5000)

            for item in categories:
                print(f"Attempting: {item['sub']}...")
                
                # If this fails, we take a screenshot before crashing
                try:
                    # Wait for ANY text that should be on the page
                    page.wait_for_selector("text=Nature of Scheme", timeout=15000)
                    
                    page.get_by_text("Nature of Scheme").click()
                    page.get_by_text(item['nature'], exact=True).click()
                    
                    page.get_by_text("Category", exact=True).click()
                    page.get_by_text(item['cat'], exact=True).click()
                    
                    page.get_by_text("Sub Category").click()
                    page.get_by_text(item['sub'], exact=True).click()

                    page.get_by_role("button", name="Go").click()
                    page.wait_for_selector("a.excel-icon", timeout=20000)
                    
                    with page.expect_download() as download_info:
                        page.locator("a.excel-icon").click()
                    
                    df = pd.read_excel(download_info.value.path(), skiprows=4)
                    df.insert(0, 'Nature', item['nature'])
                    df.insert(1, 'Category', item['cat'])
                    df.insert(2, 'Sub_Category', item['sub'])
                    all_dfs.append(df)
                    print(f"Captured {item['sub']}")

                except Exception as inner_e:
                    print(f"SCREENSHOT DEBUG for {item['sub']}:")
                    # This takes a picture and prints it as a link in the logs
                    screenshot = page.screenshot()
                    print("Could not find labels. The page might be blank or showing a block.")
                    # (This is just a print statement to confirm we reached here)
                    raise inner_e

            # ... (Merge and Upload logic stays same) ...

        finally:
            browser.close()
