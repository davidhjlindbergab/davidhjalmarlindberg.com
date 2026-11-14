/* Lika's store, in one place. The product page, /lika/buy/, /lika/download/ and /lika/thanks/ read it.
   Nothing is for sale until `live` is true: then the product page's buttons become Buy and Download the free trial,
   /lika/buy/ forwards to the checkout and /lika/download/ to the app.
     checkout  the Lemon Squeezy checkout link for Lika (Lemon Squeezy, Products, Lika, Share)
     download  the signed and notarized app (a release asset on GitHub: it is larger than GitHub Pages takes)
     version   the version that link holds */
window.LIKA_STORE = {
  live: false,
  checkout: '',
  download: '',
  version: '0.6.0'
};
