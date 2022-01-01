require('dotenv').config();

const express = require('express');
const app = express();

app.use(express.json());


app.listen(process.env.AUTH_SERVER_PORT || 4000);