require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` })
const express =  require('express');
const bodyParser = require('body-parser')
const cors = require('cors');
const multer = require('multer');
const app = express();
const shell = require('shelljs');
const fs = require("fs");

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));

const storage = multer.diskStorage({
    destination: function(req, file, cb){
        cb(null, 'csv-to-json-data/');  
    },
    filename: function (req, file, cb) { 
        cb(null , 'sheet1.csv');   
    }
})

var upload = multer({ storage: storage })

const PORT = 3000 || process.env.VUE_APP_PORT;

app.get('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.write('<h1>Hello from LifeLongLearning!</h1>');
    res.end();
});


app.get('/get-json-data', (req, res) => {
    let rawData = fs.readFileSync('nodeMap1.json');
    let jsonData = JSON.parse(rawData);
    res.json({
        message : "JSON loaded successfully",
        jsonData: jsonData
    })
    
});

app.get('/get-json-old-format',(req,res) => {
    let rawData = fs.readFileSync('nodeMap-old-format.json');
    let jsonData = JSON.parse(rawData);
    res.json({
        message : "JSON loaded successfully",
        jsonData: jsonData
    });
});

app.post('/upload', upload.single('file'), (req,res) => {
    shell.exec('./move-nodeMapJson-script.sh')
    res.json({
        file: req.file,
        message: 'File uploaded successfully.'
    });
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));