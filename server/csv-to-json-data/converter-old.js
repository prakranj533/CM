const fs = require("fs");
const csvtojson = require("csvtojson");
const uuid = require("uuid").v4;

const sheetFileName = "sheet1.csv";

const nodeMap = {};

const getNodeMapEntry = name => {
    let node = Object.values(nodeMap).find(e => e.name === name);
    if (!node) {
        const id = uuid();
        node = nodeMap[id] = {
            id,
            name,
            paths: []
        };
    }
    return node;
}

const addToNodeMap = ({ Source, Destination, Duration, Skills }, index) => {
    if (!Source) return console.log("Invalid Source on line ", index);
    if (!Destination) return console.log("Invalid Destination on line ", index);

    const srcNode = getNodeMapEntry(Source);
    const destNode = getNodeMapEntry(Destination);
    srcNode.paths.push({
        to: destNode.id,
        duration: Duration,
        skills: Skills,
    });
}

if (fs.existsSync(sheetFileName)) {
    csvtojson.csv()
        .fromFile(sheetFileName)
        .then((jsonDataArray) => {
            jsonDataArray.forEach((e, i) => addToNodeMap(e, i + 2));
            fs.writeFileSync("nodeMap-old-format.json", JSON.stringify(nodeMap, null, 2))
        });

} else {
    console.error("Make sure you have csv file with name exactly 'sheet1.csv'");
}


