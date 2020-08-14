# The backend for Datenanfragen.de

> While Datenanfragen.de is mostly run as a static site, some functionality does require a server. These endpoints are defined here.

TODO: This is still very much a work in progress. Neither the code nor this README is done yet.

## Setup

* Clone the repo.
* Fetch the required dependencies: `yarn`
* Copy `config-sample.json` to `config.json` and change the settings accordingly.
* Initialize the database: `yarn knex migrate:latest`

### Development

You can start the development server using `yarn dev`. It will reload automatically when you change something. Testing the payment providers can be done by using their respective test APIs:

* **mollie**: Use the provided test API key and the endpoint as configured in the `config-sample.json`
* **CoinGate**: Create an account at [sandbox.coingate.com](https://sandbox.coingate.com) (you'll need a "business" or "merchant" account) and use the API endpoint for the sandbox (`https://api-sandbox.coingate.com/v2/orders`) in combination with your sandbox API key.
