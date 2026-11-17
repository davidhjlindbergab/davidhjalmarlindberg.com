/* Blick's store, in one place. The product page, /blick/buy/ and /blick/download/ read it.
   Nothing is for sale until `live` is true and the three lines under it are filled in: then the product page's buttons
   become Buy with the price and Download the free trial, /blick/buy/ forwards to the checkout and /blick/download/ to the app.
     price     as it is to read on the buttons, for example '€149'
     checkout  Blick's checkout link at the store
     download  the signed and notarized app (a release asset on GitHub: it is larger than GitHub Pages takes)
     version   the version that link holds */
window.BLICK_STORE = {
  live: false,
  price: '',
  checkout: '',
  download: '',
  version: ''
};
