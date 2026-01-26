import os, boto3, pandas as pd
from playwright.sync_api import sync_playwright

# 1. Setup R2 (Using your saved Secrets)
s3 = boto3.client(
    service_name='s3',
    endpoint_url=f"https://{os.getenv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com",
    aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
    region_name="auto"
)

# Test Categories
categories = [
    {"nature": "Open Ended", "cat": "Equity", "sub": "Large Cap"},
    {"nature": "Open Ended", "cat": "Equity", "sub": "Mid Cap"}
]

def run_scraper():
    all_dfs = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={'width': 1280, 'height': 800})
        page = context.new_page()

        print("Opening AMFI website...")
        page.goto("https://www.amfiindia.com/otherdata/fund-performance", wait_until="networkidle")

        for item in categories:
            print(f"Processing: {item['sub']}...")
            
            # Instead of 'selecting', we are clicking the labels and then the options
            try:
                # Nature Dropdown
                page.get_by_text("Nature of Scheme").click()
                page.get_by_text(item['nature'], exact=True).click()
                page.wait_for_timeout(500)

                # Category Dropdown
                page.get_by_text("Category", exact=True).click()
                page.get_by_text(item['cat'], exact=True).click()
                page.wait_for_timeout(500)

                # Sub Category Dropdown
                page.get_by_text("Sub Category").click()
                page.get_by_text(item['sub'], exact=True).click()

                # Click Go
                page.get_by_role("button", name="Go").click()
                
                # Wait for Excel to be ready
                page.wait_for_selector("a.excel-icon", timeout=20000)
                
                with page.expect_download() as download_info:
                    page.locator("a.excel-icon").click()
                
                download = download_info.value
                df = pd.read_excel(download.path(), skiprows=4)
                
                # Stamping context
                df.insert(0, 'Nature', item['nature'])
                df.insert(1, 'Category', item['cat'])
                df.insert(2, 'Sub_Category', item['sub'])
                all_dfs.append(df)
                print(f"Captured data for {item['sub']}")

            except Exception as e:
                print(f"Failed to click dropdown for {item['sub']}. Error: {e}")

        if all_dfs:
            master_df = pd.concat(all_dfs, ignore_index=True)
            s3.put_object(
                Bucket="mf-data-bucket", 
                Key="master_mf_data.json", 
                Body=master_df.to_json(orient='records'),
                ContentType='application/json'
            )
            print("Successfully uploaded Master File to Cloudflare R2!")
        
        browser.close()

if __name__ == "__main__":
    run_scraper()
