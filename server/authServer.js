require('dotenv').config();
require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` });

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Redis = require('redis');
const User = require('./models/User');
const db = process.env.MONGO_DATABASE_NAME;

mongoose.connect(
  `mongodb://localhost/${db}`,
  () => console.log(`Connected to database: ${db}`),
  e => console.error(e)
);

let redisClient;
(async () => {
  redisClient = Redis.createClient();
  redisClient.on('error', (err) => console.log('Redis Client Error', err));
  await redisClient.connect();
})();

const DEFAULT_EXPIRATION = 86400;

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

app.post('/login', requestValidator, async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  const user = await User.findOne({ email });
  if(user == null) {
    return res.json({
      success: false,
      message: "Account not found with given email address"
    });
  }

  try {
    if(await bcrypt.compare(password, user.password)) {
      const firstName = user.first_name;
      const lastName = user.last_name;
      const email = user.email;

      const accessToken = generateAccessToken({ firstName, lastName, email });
      const refreshToken = generateRefreshToken({ firstName, lastName, email });
      await redisClient.set(`refresh_token?email=${email}`, refreshToken, {
        EX: DEFAULT_EXPIRATION
      });
      res.json({ accessToken, refreshToken });
    } else {
      res.status(403).json({
        success: false,
        message: "Invalid email or password" // for security reasons
      });
    }
  } catch(e) {
    res.status(500).json({
      success: false,
      message: "Something went wrong, please try again!"
    });
  }
});

app.delete('/logout', async (req, res) => {
  const refreshToken = req.body.token;
  const { email } = jwt.decode(refreshToken);

  try {
    await redisClient.del(`refresh_token?email=${email}`);
    res.sendStatus(204);
  } catch(e) {
    console.error(e);
    res.status(500).json({
      success: false,
      message: "Something went wrong, please try again!"
    })
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

function generateRefreshToken(user) {
  return jwt.sign(user, process.env.REFRESH_TOKEN_SECRET);
}

function requestValidator(req, res, next) {
  const email = req.body.email;
  const password = req.body.password;

  if(!email) {
    return res.status(400).json({
      success: false,
      message: "Email field is empty"
    });
  }

  if(!password) {
    return res.status(400).json({
      success: false,
      message: "Password field is empty"
    });
  }

  next();
}

app.listen(process.env.AUTH_SERVER_PORT || 4000);