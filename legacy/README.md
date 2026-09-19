# career-maps

## Steps for adding sheet data to deployed website

Important Points 
1. Glory should maintain one final sheet which has all the nodes data till today - here is sheet https://docs.google.com/spreadsheets/d/1ZC6GtlGohWRv8JYN-WMigqEwdcfGK-mPJVtJ-PcoTPA/edit#gid=0 (This is single source of truth for all node data.)
2. There is edit node functionality on frontend in /manage-nodes tab which should not be used for now since Glory is comfortable with CSV for now.
3. All data must be added with precaution that there should not be any loop, for example, 10th is child node of 8th and 8th is child node of 10th, this is not logically correct and will create issues.

### Softwares required on machine.
#### Download and install following softwares on your machine.
  1. Github Desktop - https://desktop.github.com/ (Use github credentials to login when asked)
  2. NodeJS - https://nodejs.org/en/download/

#### One time setup
1. Go to https://github.com/lifelonglearningindia/career-maps
2. Click on Code (green button next to "Add file" button)
3. Click on "Open with Github Desktop" - It will open github desktop
4. Click on "clone again" - (Check working directory location) this will download all the code to local machine
5. Open terminal and go to working directory where project is clonned
6. Type following commands - 
```bash
chmod +x deploy-updated-nodes.sh
cd csv-to-json-data
npm install
```
/**** Setup is Done ****/

### Deployment steps
1. Download the Sheet in csv format 
2. Rename it to "sheet.csv"
3. Copy Sheet to folder "csv-to-json-data" in working directory
4. Open Terminal - Go to working directory
5. Execute command `./deploy-updated-nodes.sh`
