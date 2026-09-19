#!/bin/bash

cd csv-to-json-data

npm run convert

cd ..

mv csv-to-json-data/nodeMap.json src/data/

git add --all
git commit -m "Added new data nodes"
git push