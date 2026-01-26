import os, boto3, pandas as pd
from playwright.sync_api import sync_playwright

# 1. Setup R2 (Same as before)
s3 = boto3.client(
    service_name='s3',
    endpoint_url=f"https://{os.getenv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com",
    aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
    region_name="auto"
)

# Testing categories
categories = [
    {"nature": "Open Ended", "cat": "Equity", "sub": "Large Cap"},
    {"nature": "Open Ended", "cat": "Equity", "sub": "Mid Cap"}
]

def run_scraper():
    all_dfs = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a real browser profile
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        print("Opening AMFI website...")
        # wait_until="networkidle" is key for Next.js sites
        page.goto("https://www.amfiindia.com/otherdata/fund-performance", wait_until="networkidle")

        for item in categories:
            print(f"Selecting: {item['nature']} > {item['cat']} > {item['sub']}")
            
            # MODERN SELECTOR: We look for the dropdowns by their visible text or generic tags
            # because Next.js often hides the real <select> element.
            try:
                # Step A: Select Nature (Open Ended)
                page.get_by_label("Nature of Scheme").select_option(label=item['nature'])
                page.wait_for_timeout(1000)
                
                # Step B: Select Category (Equity)
                page.get_by_label("Category").select_option(label=item['cat'])
                page.wait_for_timeout(1000)
                
                # Step C: Select Sub-Category (Large Cap)
                page.get_by_label("Sub Category").select_option(label=item['sub'])
                
                # Step D: Click Go
                page.get_by_role("button", name="Go").click()
                
                # Step E: Wait for Excel Icon
                page.wait_for_selector("a.excel-icon", timeout=20000)
                
                with page.expect_download() as download_info:
                    page.get_by_role("link", name="Excel").first.click()
                
                download = download_info.value
                df = pd.read_excel(download.path(), skiprows=4)
                
                # Stamping context
                df.insert(0, 'Nature', item['nature'])
                df.insert(1, 'Category', item['cat'])
                df.insert(2, 'Sub_Category', item['sub'])
                all_dfs.append(df)
                print(f"Captured {len(df)} schemes.")

            except Exception as e:
                print(f"Failed to find dropdowns for {item['sub']}. The site might be using custom UI components.")
                # FALLBACK: Try selecting by generic dropdown order if labels fail
                page.locator("select").nth(0).select_option(label=item['nature'])
                page.locator("select").nth(1).select_option(label=item['cat'])
                page.locator("select").nth(2).select_option(label=item['sub'])
                page.get_by_role("button", name="Go").click()

        # Finalize and Upload
        if all_dfs:
            master_df = pd.concat(all_dfs, ignore_index=True)
            s3.put_object(
                Bucket="mf-data-bucket", 
                Key="master_mf_data.json", 
                Body=master_df.to_json(orient='records'),
                ContentType='application/json'
            )
            print("Successfully uploaded Master File to R2.")
        
        browser.close()

if __name__ == "__main__":
    run_scraper()
