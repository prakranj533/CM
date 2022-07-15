require('dotenv').config();
require('dotenv').config({ path: `.env.${process.env.NODE_ENV}` });

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Redis = require('redis');
const User = require('./models/User');

const mongoClientConfig = {
  host: process.env.MONGO_HOST,
  port: process.env.MONGO_PORT,
  user: process.env.MONGO_USER,
  password: process.env.MONGO_PASSWORD,
  db: process.env.MONGO_DATABASE_NAME
};
const redisClientConfig = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
};

let mongoURI = `${mongoClientConfig.host}:${mongoClientConfig.port}/${mongoClientConfig.db}`;
const mongooseConnectOptions = {};

if(process.env.NODE_ENV === 'production') {
  mongooseConnectOptions['authSource'] = mongoClientConfig.db;
  mongooseConnectOptions['user'] = mongoClientConfig.user;
  mongooseConnectOptions['pass'] = mongoClientConfig.password;
  redisClientConfig['password'] = process.env.REDIS_PASSWORD;
}

mongoURI = "mongodb://" + mongoURI;
console.log(mongoClientConfig, mongoURI);
const connectWithRetry = () => {
  return mongoose.connect(
    mongoURI,
    mongooseConnectOptions,
    () => console.log(`Connected to Mongo; Database: ${mongoClientConfig.db}`),
    (err) => {
      if(err) {
        console.error('Failed to connect to Mongo on startup - retrying in 5 sec', err);
        setTimeout(connectWithRetry, 5000);
      }
    }
  );
};
connectWithRetry();

process.on('SIGINT', function() {
  mongoose.connection.close(function() {
    console.log('Mongoose disconnected on app termination');
    process.exit(0);
  });
});

let redisClient;
(async () => {
  redisClient = Redis.createClient(redisClientConfig);
  redisClient.on('error', (err) => console.log('Redis Client Error', err));
  await redisClient.connect();
})();

const DEFAULT_EXPIRATION = 86400;

const app = express();
app.use(express.json());
app.use(cors());

app.post('/register', async (req, res) => {
  const firstName = req.body.first_name;
  const lastName = req.body.last_name;
  const email = req.body.email;
  const dob = req.body.dob;

  try {
    if(await doesUserExists(email)) {
      res.json({
        success: false,
        message: "Email address already in use"
      });
    }

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
      accessToken: generateAccessToken({ firstName, lastName, email }),
      refreshToken: generateRefreshToken({ firstName, lastName, email })
    });
  } catch(e) {
    console.error(e);
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
      console.log(user);
      const firstName = user.first_name;
      const lastName = user.last_name;
      const email = user.email;
      const is_admin = user.is_admin;
      const role = user.role;
      const accessToken = generateAccessToken({ firstName, lastName, email, is_admin, role });
      const refreshToken = generateRefreshToken({ firstName, lastName, email, is_admin, role });
      await redisClient.set(`refresh_token?email=${email}`, refreshToken, {
        EX: DEFAULT_EXPIRATION
      });
      res.json({ success: true, accessToken, refreshToken });
    } else {
      res.status(403).json({
        success: false,
        message: "Invalid email or password" // for security reasons
      });
    }
  } catch(e) {
    res.json({
      success: false,
      message: e.message
    });
  }
});

app.delete('/logout', async (req, res) => {
  const refreshToken = req.body.token;
  if(refreshToken == null) return res.sendStatus(401);

  try {
    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, async (err, user) => {
      if(err) return res.sendStatus(403);
      await redisClient.del(`refresh_token?email=${user.email}`);
      res.sendStatus(204);
    });
  } catch(e) {
    console.error(e);
    res.json({
      success: false,
      message: e.message
    });
  }
});

app.post('/token', async (req, res) => {
  const refreshToken = req.body.token;
  if(refreshToken == null) return res.sendStatus(401);

  try {
    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, async (err, user) => {
      if(err) return res.sendStatus(403);
      
      const output = await redisClient.get(`refresh_token?email=${user.email}`);
      if(output == null) return res.sendStatus(403);

      const accessToken = generateAccessToken({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      });
      res.json({ accessToken });
    });
  } catch(e) {
    console.error(e);
    res.json({
      success: false,
      message: e.message
    });
  }
});

app.get('/users', async (req, res) => {
  const users = await User.find({ });
  res.json({
    success: true,
    message: "JSON loaded successfully",
    data: users
  });
});

async function doesUserExists(email) {
  const user = await User.findOne({ email });
  if(user) return true;
  return false;
}

function generateAccessToken(user) {
  console.log( process.env.ACCESS_TOKEN_SECRET);
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

const PORT = process.env.AUTH_SERVER_PORT || 8001;
app.listen(PORT, () => console.log(`Authentication server listening on port ${PORT}`));