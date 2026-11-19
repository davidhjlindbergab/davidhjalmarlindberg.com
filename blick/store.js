/* Blick's store, in one place. The product page, /blick/buy/ and /blick/download/ read it.
   The prices are David's (19 Nov 2026): 49 euros a month or 495 a year. They are shown on the page as they stand here.
   Nothing is for sale until `live` is true and the three addresses are filled in: then the product page's buttons become
   Try it free for 7 days, each plan gets a button to its checkout, /blick/buy/ offers the two plans and /blick/download/
   forwards to the app.
     monthly.checkout, yearly.checkout   each plan's checkout link at the store
     download   the signed and notarized app (a release asset on GitHub: it is larger than GitHub Pages takes)
     version    the version that link holds */
window.BLICK_STORE = {
  live: false,
  monthly: { price: '\u20ac49', checkout: '' },
  yearly: { price: '\u20ac495', checkout: '' },
  download: '',
  version: ''
};
