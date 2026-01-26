import os
import boto3
import pandas as pd
from playwright.sync_api import sync_playwright

# 1. Setup Cloudflare R2 Connection
s3 = boto3.client(
    service_name='s3',
    endpoint_url=f"https://{os.getenv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com",
    aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
    region_name="auto"
)

BUCKET_NAME = "mf-data-bucket"

# Test with 2 categories
categories = [
    {"nature": "Open Ended", "cat": "Equity", "sub": "Large Cap"},
    {"nature": "Open Ended", "cat": "Equity", "sub": "Mid Cap"}
]

def run_scraper():
    all_dfs = []
    
    with sync_playwright() as p:
        # Launch browser with "Stealth" arguments
        browser = p.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={'width': 1280, 'height': 800}
        )
        page = context.new_page()
        
        try:
            print("Opening AMFI website...")
            # We use a longer timeout and wait for 'load'
            page.goto("https://www.amfiindia.com/otherdata/fund-performance", wait_until="load", timeout=90000)
            
            # Small pause to let any pop-ups or scripts finish
            page.wait_for_timeout(5000)
            print(f"Page Title: {page.title()}")

            for item in categories:
                print(f"Selecting: {item['sub']}...")
                
                # Check if the dropdown is actually there. If not, this will print the error.
                page.wait_for_selector("select#NavOpen", timeout=30000)
                
                # Select the options
                page.select_option("select#NavOpen", label=item['nature'])
                page.wait_for_timeout(1000) # Give the site a second to refresh the next dropdown
                
                page.select_option("select#Category", label=item['cat'])
                page.wait_for_timeout(1000)
                
                page.select_option("select#SubCategory", label=item['sub'])
                
                # Click Go
                page.click("input#btnGo")
                
                # Wait for the Excel icon to appear (this confirms the data loaded)
                page.wait_for_selector("a.excel-icon", timeout=30000)

                with page.expect_download() as download_info:
                    page.click("a.excel-icon")
                download = download_info.value
                
                df = pd.read_excel(download.path(), skiprows=4)
                df.insert(0, 'Nature_of_Scheme', item['nature'])
                df.insert(1, 'Category', item['cat'])
                df.insert(2, 'Sub_Category', item['sub'])
                
                all_dfs.append(df)
                print(f"Success! Captured {len(df)} funds.")

            # Merge and Upload
            master_df = pd.concat(all_dfs, ignore_index=True)
            s3.put_object(
                Bucket=BUCKET_NAME,
                Key='master_mf_data.json',
                Body=master_df.to_json(orient='records'),
                ContentType='application/json'
            )
            print("Master file uploaded to R2 successfully!")

        except Exception as e:
            print(f"ERROR OCCURRED: {e}")
            # DEBUG: Print what the robot actually sees on the page
            print("DEBUG: Current page content snippet:")
            print(page.content()[:1000]) # Prints the first 1000 characters of code
            raise e

        finally:
            browser.close()

if __name__ == "__main__":
    run_scraper()
