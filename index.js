const express = require("express");
const path = require("path");
const hbs = require("express-handlebars");
const dotenv = require("dotenv");
const morgan = require("morgan");
//const { uuid } = require("uuidv4");
const { Client, Config, CheckoutAPI } = require("@adyen/api-library");
const app = express();

// Set up request logging
app.use(morgan("dev"));
// Parse JSON bodies
app.use(express.json());
// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));
// Serve client from build folder
app.use(express.static(path.join(__dirname, "/public")));

// Enables environment variables by parsing the .env file and assigning it to process.env
dotenv.config({
  path: "./.env",
});

// Adyen Node.js API library  (configuration, etc.)
const config = new Config();
config.apiKey = process.env.API_KEY;
const client = new Client({ config });
client.setEnvironment("TEST");
const checkout = new CheckoutAPI(client);

app.engine(
  "handlebars",
  hbs({
    defaultLayout: "main",
    layoutsDir: __dirname + "/views/layouts",
  })
);

app.set("view engine", "handlebars");

const paymentDataStore = {};

// Get payment methods
app.get("/", async (req, res) => {
  try {
    const response = await checkout.paymentMethods({
      countryCode: "NL",
      shopperLocale: "nl-NL",
      amount: { currency: "EUR", value: 1000, },
      channel: "Web",
      merchantAccount: process.env.MERCHANT_ACCOUNT,
    });
    console.log(process.env.CLIENT_KEY);
    res.render("payment", {
      clientKey: process.env.CLIENT_KEY,
      response: JSON.stringify(response),
    });
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.status(err.statusCode).json(err.message);
  }
});

app.post("/api/initiatePayment", async (req, res) => {
  try {
    // Ideally the data passed here should be computed based on business logic
    const response = await checkout.payments({
      amount: { currency: "EUR", value: 1000 }, // value is 10€ in minor units
      reference: "DanielAkinola_adyenrecruitment",
      merchantAccount: process.env.MERCHANT_ACCOUNT,
      channel: "Web",
      additionalData: {
        allow3DS2: true
      },
      returnUrl: "https://docs.adyen.com/",
      paymentMethod: req.body.paymentMethod,
    });
    console.log(response);

    let resultCode = response.resultCode;
    let action = null;

    if (response.action) {
      action = response.action;
    }

    res.json({ resultCode, action });
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.status(err.statusCode).json(err.message);
  }
});

app.all("/api/handleShopperRedirect", async (req, res) => {
  // Create the payload for submitting payment details
  const payload = {};
  payload.details = req.method === "GET" ? req.query : req.body;

  try {
    const response = await checkout.paymentsDetails(payload);
    // Conditionally handle different result codes for the shopper
    console.log(response.pspReference);
    switch (response.resultCode) {
      case "Authorised":
        res.redirect("/success");
        break;
      case "Pending":
      case "Received":
        res.redirect("/pending");
        break;
      case "Refused":
        res.redirect("/failed");
        break;
      default:
        res.redirect("/error");
        break;
    }
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.redirect("/error");
  }
});

// Handle submitting additional details
app.post("/api/submitAdditionalDetails", async (req, res) => {
  // Create the payload for submitting payment details
  const payload = {};
  payload.details = req.body.details;
  payload.paymentData = req.body.paymentData;

  try {
    // Return the response back to client (for further action handling or presenting result to shopper)
    const response = await checkout.paymentsDetails(payload);
    let resultCode = response.resultCode;
    let action = response.action || null;

    res.json({ action, resultCode });
  } catch (err) {
    console.error(`Error: ${err.message}, error code: ${err.errorCode}`);
    res.status(err.statusCode).json(err.message);
  }
});

// Authorised result page
app.get("/success", (req, res) => res.render("success"));

// Pending result page
app.get("/pending", (req, res) => res.render("pending"));

// Error result page
app.get("/error", (req, res) => res.render("error"));

// Refused result page
app.get("/failed", (req, res) => res.render("failed"));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on localhost: ${PORT}`));
