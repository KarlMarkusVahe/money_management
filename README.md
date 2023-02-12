# Example backend for ITA21

This backend serves as a reference implementation for ITA21 projects. It is a basic HTTP server, built using the Express framework in JavaScript,designed solely for testing and development purposes. Please note that it is not intended for production use and lacks security, speed, scalability, and aesthetics. Its purpose is solely to support the testing of the frontend and serves as an example of a backend for ITA21 projects.

## Prerequisites

To begin working with this project, you need to have Node.js installed on your machine. You can download it from the official Node.js website (https://nodejs.org/en/download/).


## Getting Started

Once you have installed Node.js, follow these steps:

1. Fork and clone this repository to your local machine.
1. Open the root directory of the project in terminal. 
1. Copy the .env.sample file to .env by executing `cp .env.sample .env` and change the values to your liking.
1. Run `npm install` to install all the necessary dependencies for the project.
1. Run `npm start` to start the server on port 3000 (or whatever port you have specified in the .env file).
1. Navigate to [http://localhost:3000/docs](http://localhost:3000/docs) to see the API documentation.

## Usage

You must create your front end app in public/index.html file. Your front end app will be using the API in index.js as its backend. You can use for example Vue in CDN mode for front end. When needed, create new endpoints in index.js for your front end app. Do not forget to document them in the [swagger.yaml](swagger.yaml) file. An excellent way to generate content to swagger.yaml is to use Apicurio Studio (https://studio.apicur.io/).

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

## Acknowledgments

- [Express](https://expressjs.com/) for the web framework.
- [Node.js](https://nodejs.org/en/) for the JavaScript runtime.
- [NPM](https://www.npmjs.com/) for the package manager.
- [Dotenv](https://www.npmjs.com/package/dotenv) for the environment variables.
- [Bcrypt](https://www.npmjs.com/package/bcrypt) for the password hashing.
-
