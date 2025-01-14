const express = require("express");
const AWS = require("aws-sdk");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const cors = require('cors');
const app = express();
app.use(bodyParser.json());
app.use(cors());
require("dotenv").config();
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();

const USERS_TABLE = "users";
const ORDERS_TABLE = "orders";
const JWT_SECRET = process.env.JWT_SECRET;

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Access token required" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
};

app.post("/signup", async (req, res) => {
  console.log(process.env.AWS_REGION);
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const params = {
    TableName: USERS_TABLE,
    Item: {
      id: uuidv4(),
      username: username,
      password: hashedPassword,
    },
  };
  try {
    await dynamoDB.put(params).promise();
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Could not register user", error: error.message });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Username and password are required" });
  }
  const params = {
    TableName: USERS_TABLE,
    FilterExpression: "username = :username",
    ExpressionAttributeValues: { ":username": username },
  };
  try {
    const result = await dynamoDB.scan(params).promise();
    const user = result.Items[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid username or password" });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
    res.status(200).json({ token });
  } catch (error) {
    res.status(500).json({ message: "Could not log in", error: error.message });
  }
});

app.post("/checkout", authenticateToken, async (req, res) => {
  const { productName, quantity } = req.body;
  if (!productName || !quantity) {
    return res.status(400).json({
      message: "Please provide productName and quantity.",
    });
  }
  const params = {
    TableName: ORDERS_TABLE,
    Item: {
      id: uuidv4(),
      customerId: req.user.id,
      productname: productName,
      quantity: quantity,
    },
  };
  try {
    await dynamoDB.put(params).promise();
    res.status(201).json({
      message: "Order inserted successfully",
      order: params.Item,
    });
  } catch (error) {
    res.status(500).json({
      message: "Could not insert order",
      error: error.message,
    });
  }
});

app.get("/past-checkouts", authenticateToken, async (req, res) => {
  const { id } = req.query;
  console.log(id);
  const params = {
    TableName: ORDERS_TABLE,
    FilterExpression: "customerId = :customerId",
    ExpressionAttributeValues: {
      ":customerId": parseInt(id),
    },
  };
  try {
    const result = await dynamoDB.scan(params).promise();
    res.status(200).json({ orders: result.Items });
  } catch (error) {
    res.status(500).json({
      message: "Could not fetch orders",
      error: error.message,
    });
  }
});

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
