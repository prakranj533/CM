require('dotenv').config();
require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` });

const express =  require('express');
const cors = require('cors');
const multer = require('multer');
const shell = require('shelljs');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'csv-to-json-data/');  
  },
  filename: function (req, file, cb) { 
    cb(null , 'sheet1.csv');   
  }
})

var upload = multer({ storage: storage });

app.get('/', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: "Hello from LifeLongLearning!"
  });
});

app.get('/get-json-data', authenticateToken, (req, res) => {
  const rawData = fs.readFileSync('nodeMap1.json');
  const jsonData = JSON.parse(rawData);
  res.json({
    success: true,
    message: "JSON loaded successfully",
    jsonData: jsonData
  });
});

app.get('/get-json-old-format', authenticateToken, (req, res) => {
  const rawData = fs.readFileSync('nodeMap-old-format.json');
  const jsonData = JSON.parse(rawData);
  res.json({
    success: true,
    message: "JSON loaded successfully",
    jsonData: jsonData
  });
});

app.post('/upload', [authenticateToken, upload.single('file')], (req, res) => {
  shell.exec('./move-nodeMapJson-script.sh')
  res.json({
    success: true,
    file: req.file,
    message: 'File uploaded successfully.'
  });
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if(token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if(err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

const PORT = process.env.APP_SERVER_PORT || 3000;
app.listen(PORT, () => console.log(`App server listening on port ${PORT}`));