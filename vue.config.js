module.exports = {
  publicPath: '/',
  transpileDependencies: [
    'vuetify'
  ],
  devServer: {
    port: 3000, proxy: 'http://localhost:9001/',
  }
}