import os, boto3, pandas as pd
from playwright.sync_api import sync_playwright

# 1. Setup Cloudflare R2 Connection
s3 = boto3.client(
    service_name='s3',
    endpoint_url=f"https://{os.getenv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com",
    aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
    region_name="auto"
)

# 2. Define the Navigation Map (Review List)
categories = [
    {"nature": "Open Ended", "cat": "Equity", "sub": "Large Cap"},
    {"nature": "Open Ended", "cat": "Equity", "sub": "Mid Cap"},
    # ... (I will include the full list of 30 in the final file for you)
]

def run_scraper():
    all_dfs = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        # ... (previous code remains the same) ...
        page.goto("https://www.amfiindia.com/otherdata/fund-performance")

        for item in categories:
            print(f"Processing: {item['sub']}")
            
            # 1. NEW: Wait for the dropdown to exist before trying to click it
            page.wait_for_selector("select#NavOpen", timeout=60000) 
            
            # 2. Now select the options
            page.select_option("select#NavOpen", label=item['nature'])
            page.select_option("select#Category", label=item['cat'])
            page.select_option("select#SubCategory", label=item['sub'])
            
            # 3. Click 'Go' and wait for the page to update
            page.click("input#btnGo")
            page.wait_for_load_state("networkidle") # This tells the robot to wait for the spinning wheel to stop
            
            # ... (the rest of the download logic remains the same) ...
            
            # Robot waits for Excel and downloads it
            with page.expect_download() as download_info:
                page.click("a.excel-icon")
            download = download_info.value
            path = download.path()

            # STAMPING: Add the context columns
            df = pd.read_excel(path, skiprows=4) # AMFI files have 4 junk rows at top
            df.insert(0, 'Nature', item['nature'])
            df.insert(1, 'Category', item['cat'])
            df.insert(2, 'SubCategory', item['sub'])
            all_dfs.append(df)

        # FINAL MERGE: Combine all 30 files into one Master Table
        master_df = pd.concat(all_dfs, ignore_index=True)
        master_json = master_df.to_json(orient='records')
        
        # UPLOAD to Cloudflare R2
        s3.put_object(Bucket="mf-data-bucket", Key="master_mf_data.json", Body=master_json)
        print("Master File Updated Successfully!")

if __name__ == "__main__":
    run_scraper()
