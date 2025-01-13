const path = require("path");

module.exports = {
  entry: "./src/index.js", // Entry point for your app
  output: {
    path: path.resolve(__dirname, "dist"), // Output directory
    filename: "bundle.js", // Output file
    clean: true, // Clean the output directory before building
  },
  module: {
    rules: [
      {
        test: /\.js|\.jsx$/, // Match .js and .jsx files
        exclude: /node_modules/, // Exclude node_modules for performance
        use: {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-react", "@babel/preset-env"],
            },
        },
      },
      {
        test: /\.css$/, // Optional: Match .css files for styles
        use: ["style-loader", "css-loader"], // Process CSS files
      },
    ],
  },
  resolve: {
    extensions: [".js", ".jsx"], // Automatically resolve these extensions
  },
  devServer: {
    static: path.resolve(__dirname, "dist"), // Serve files from dist
    port: 3001, // Change the dev server port
    hot: true, // Enable hot module replacement
    open: true, // Open the app in the browser
  },
};