import os
import boto3
import pandas as pd
import io
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

# 2. Starter List (Just 2 categories for testing)
categories = [
    {"nature": "Open Ended", "cat": "Equity", "sub": "Large Cap"},
    {"nature": "Open Ended", "cat": "Equity", "sub": "Mid Cap"}
]

def run_scraper():
    all_dfs = []
    
    with sync_playwright() as p:
        # Launching browser with a 'User Agent' to prevent blocking
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        
        print("Opening AMFI website...")
        page.goto("https://www.amfiindia.com/otherdata/fund-performance", wait_until="networkidle")

        for item in categories:
            print(f"Selecting: {item['nature']} > {item['cat']} > {item['sub']}")
            
            # Wait for dropdowns and select
            page.wait_for_selector("select#NavOpen")
            page.select_option("select#NavOpen", label=item['nature'])
            
            page.wait_for_selector("select#Category")
            page.select_option("select#Category", label=item['cat'])
            
            page.wait_for_selector("select#SubCategory")
            page.select_option("select#SubCategory", label=item['sub'])
            
            # Click Go and wait for the table to appear
            page.click("input#btnGo")
            page.wait_for_selector("a.excel-icon", timeout=10000)

            # Download the Excel file
            with page.expect_download() as download_info:
                page.click("a.excel-icon")
            download = download_info.value
            
            # Read the downloaded file into memory
            # We use 'skiprows=4' because AMFI files have headers at the top
            df = pd.read_excel(download.path(), skiprows=4)
            
            # STAMPING: Add our context columns
            df.insert(0, 'Nature_of_Scheme', item['nature'])
            df.insert(1, 'Category', item['cat'])
            df.insert(2, 'Sub_Category', item['sub'])
            
            all_dfs.append(df)
            print(f"Successfully captured {len(df)} funds for {item['sub']}")

        # Combine both categories into one master table
        master_df = pd.concat(all_dfs, ignore_index=True)
        
        # Convert to JSON string
        json_output = master_df.to_json(orient='records')
        
        # 3. Upload to Cloudflare R2
        print("Uploading master file to Cloudflare R2...")
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key='master_mf_data.json',
            Body=json_output,
            ContentType='application/json'
        )
        print("All done! Master file is now in R2.")
        
        browser.close()

if __name__ == "__main__":
    run_scraper()
