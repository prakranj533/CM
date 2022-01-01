require('dotenv').config();

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = express();

app.use(express.json());

const users = [];

app.post('/register', async (req, res) => {
  const firstName = req.body.first_name;
  const lastName = req.body.last_name;
  const email = req.body.email;
  const dob = `${req.body.year}-${req.body.month}-${req.body.date}`;

  if(doesUserExists(email)) {
    return res.json({
      success: false,
      message: "Email address already in use"
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    users.push({
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

function doesUserExists(email) {
  return users.find(user => user.email === email);
}

function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" });
}

app.listen(process.env.AUTH_SERVER_PORT || 4000);