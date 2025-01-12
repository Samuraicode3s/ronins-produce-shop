const express = require("express");
const AWS = require("aws-sdk");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");
const app = express();
app.use(bodyParser.json());
require("dotenv").config();
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = "orders";
app.post("/checkout", async (req, res) => {
  const { customerId, productName, quantity } = req.body;
  if (!customerId || !productName || !quantity) {
    return res.status(400).json({
      message: "Please provide customerId, productName, and quantity.",
    });
  }
  const params = {
    TableName: TABLE_NAME,
    Item: {
      id: uuidv4(),
      customerId: customerId,
      productname: productName,
      quantity: quantity,
    },
  };
  try {
    await dynamoDB.put(params).promise();
    res
      .status(201)
      .json({ message: "Order inserted successfully", order: params.Item });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Could not insert order", error: error.message });
  }
});

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
