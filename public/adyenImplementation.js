async function callServer(url, data) {
  try {
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(data),
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.json();
  } catch (error) {
    console.error(error);
  }
}

// Handles responses sent from your server to the client
function handleServerResponse(res, dropin) {
  if (res.action) {
    dropin.handleAction(res.action);
  } else {
    switch (res.resultCode) {
      case "Authorised":
        window.location.href = "/success";
        break;
      case "Pending":
        window.location.href = "/pending";
        break;
      case "Refused":
        window.location.href = "/failed";
        break;
      default:
        window.location.href = "/error";
        break;
    }
  }
}

// Event handlers called when the shopper selects the pay button,
// or when additional information is required to complete the payment
async function handleSubmission(state, dropin, url) {
  try {
    const response = await callServer(url, state.data);
    return handleServerResponse(response, dropin);
  } catch (error) {
    console.error(error);
  }
}

const paymentMethodsResponse = JSON.parse(document.getElementById("paymentMethodsResponse").innerHTML);
const clientKey = document.getElementById("clientKey").innerHTML;
console.log(clientKey);

const configuration = {
  paymentMethodsResponse,
  clientKey,
  removePaymentMethods: "paywithgoogle",
  locale: "en_US",
  environment: "test",
  paymentMethodsConfiguration: {
    card: {
      holderNameRequired: true,
      enableStoreDetails: true,
      hideCVC: false, // Change this to true to hide the CVC field for stored cards
      hasHolderName: true,
    },
  },
  onSubmit: (state, dropin) => {
    handleSubmission(state, dropin, "/api/initiatePayment");
  },
  onAdditionalDetails: (state, dropin) => {
    handleSubmission(state, dropin, "/api/submitAdditionalDetails");
  },
};

const checkout = new AdyenCheckout(configuration);
const integration = checkout.create("dropin").mount(document.getElementById("dropin"));
