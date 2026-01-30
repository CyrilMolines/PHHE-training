@echo off
echo.
echo ================================================
echo    WHO PHHE Training Data Sync
echo ================================================
echo.
echo This will help you sync SharePoint data to GitHub.
echo.
echo STEP 1: Export from SharePoint
echo --------------------------------
echo Opening SharePoint list in your browser...
echo Export it as CSV: Click "Export" then "Export to CSV"
echo.
start "" "https://worldhealthorg.sharepoint.com/sites/EuroWCPHE/Lists/Copytraininglist2912026"
echo.
pause
echo.
echo STEP 2: Convert CSV to JSON
echo --------------------------------
echo Opening the Data Export tool...
echo Upload your CSV file and download the JSON.
echo.
start "" "https://cyrilmolines.github.io/PHHE-training/export/"
echo.
pause
echo.
echo STEP 3: Upload to GitHub
echo --------------------------------
echo Opening GitHub repository...
echo Upload the demo-trainings.json file.
echo.
start "" "https://github.com/CyrilMolines/PHHE-training/upload/main"
echo.
echo Done! Changes will be live in ~2 minutes.
echo.
pause
