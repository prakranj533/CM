require('dotenv').config();
require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` });

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('./models/User');
const db = process.env.MONGO_DATABASE_NAME;

mongoose.connect(
  `mongodb://localhost/${db}`,
  () => console.log(`Connected to database: ${db}`),
  e => console.error(e)
);

const app = express();
app.use(express.json());

app.post('/register', async (req, res) => {
  const firstName = req.body.first_name;
  const lastName = req.body.last_name;
  const email = req.body.email;
  const dob = req.body.dob;

  if(await doesUserExists(email)) {
    return res.json({
      success: false,
      message: "Email address already in use"
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    await User.create({
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      email: req.body.email,
      password: hashedPassword,
      dob: dob,
      gender: req.body.gender
    });
    res.json({
      success: true,
      token: generateAccessToken({ firstName, lastName, email })
    });
  } catch(e) {
    res.json({
      success: false,
      message: e.message
    });
  }
});

async function doesUserExists(email) {
  const user = await User.findOne({ email });
  if(user) return true;
  return false;
}

function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" });
}

app.listen(process.env.AUTH_SERVER_PORT || 4000);