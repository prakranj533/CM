const fs = require("fs");
const csvtojson = require("csvtojson");
const uuid = require("uuid").v4;

const sheetFileName = "sheet1.csv";

const nodeMap = {};

const addToNodeMap = (jsonDataArray) => {
    const nodes = []
    const links = []
    for(let jsonData of jsonDataArray){
        let sourceObj = {
            id : jsonData.Source
        }
        let targetObj = {
            id : jsonData.Destination
        }
        let linkObj = {
            source : jsonData.Source,
            target : jsonData.Destination
        }
        nodes.push(sourceObj)
        nodes.push(targetObj)
        links.push(linkObj)
    }
    const jsonObject = nodes.map(JSON.stringify);
    const uniqueNodeSet = new Set(jsonObject);
    const uniqueNodeArr = Array.from(uniqueNodeSet).map(JSON.parse);
    nodeMap["nodes"] = uniqueNodeArr;
    nodeMap["links"] = links;

}

if (fs.existsSync(sheetFileName)) {
    csvtojson.csv()
        .fromFile(sheetFileName)
        .then((jsonDataArray) => {
            addToNodeMap(jsonDataArray);
            fs.writeFileSync("nodeMap1.json", JSON.stringify(nodeMap, null, 4))
        });

} else {
    console.error("Make sure you have csv file with name exactly 'sheet.csv'");
}


