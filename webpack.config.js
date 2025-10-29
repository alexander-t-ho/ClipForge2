const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    main: './src/index.js'
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'bundle.js',
    publicPath: '/'  // Changed from './' to '/' for dev server
  },
  stats: {
    children: true,
    errorDetails: true,
    moduleTrace: true
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource'
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'public', 'index.template.html'),
      filename: 'index.html',
      inject: true,
      minify: false,
      cache: false // Disable caching to avoid stale references
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
      publicPath: '/public',
      watch: true
    },
    port: 3000,
    hot: true,
    compress: true,
    historyApiFallback: true,
    open: false,
    client: {
      overlay: true,
      logging: 'info'
    }
  },
  resolve: {
    extensions: ['.js', '.jsx']
  }
};
