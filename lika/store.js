/* Lika's store, in one place. The product page, /lika/buy/, /lika/download/ and /lika/thanks/ read it.
   Nothing is for sale until `live` is true: then the product page's buttons become Buy and Download the free trial,
   /lika/buy/ forwards to the checkout and /lika/download/ to the app.
     checkout  Lika's checkout link on Polar (Products, Checkout Links, "Lika website (Buy button)"; after paying it sends
               the buyer to /lika/thanks/?bought={CHECKOUT_ID}, which shows the key)
     download  the signed and notarized app (a release asset on GitHub: it is larger than GitHub Pages takes)
     version   the version that link holds */
window.LIKA_STORE = {
  live: false,
  checkout: 'https://buy.polar.sh/polar_cl_emSqP3wXtn8uIz5IY74yfoEV77vMXrLmcOFWR3PPPR9',
  download: '',
  version: '0.6.0'
};
