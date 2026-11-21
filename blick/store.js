/* Blick's store, in one place. The product page, /blick/buy/ and /blick/download/ read it.
   The prices are David's (19 Nov 2026): 49 euros a month or 495 a year. They are shown on the page as they stand here.
   Nothing is for sale until `live` is true and the three addresses are filled in: then the product page's buttons become
   Try it free for 7 days, each plan gets a button to its checkout, /blick/buy/ offers the two plans and /blick/download/
   forwards to the app.
     monthly.checkout, yearly.checkout   each plan's checkout link at the store (Polar; each sends the buyer on to
                                         /blick/thanks/?bought={CHECKOUT_ID}, which shows the key)
     download   the signed and notarized app for the Mac (a release asset on GitHub: it is larger than GitHub Pages takes)
     downloadWin  the app for Windows, 64-bit (the same release; /blick/download/ offers it to a visitor on Windows,
                  and to anyone who asks for it there). Empty: Windows is not offered.
     version    the version that link holds */
window.BLICK_STORE = {
  live: true,
  monthly: { price: '\u20ac49', checkout: 'https://buy.polar.sh/polar_cl_ckr0X9FwjOHj01flRe8hq6phO5JdZixgoTARB2yzqwe' },
  yearly: { price: '\u20ac495', checkout: 'https://buy.polar.sh/polar_cl_ZSTUFMM4WkBDfQlGgL7B5v69gHi7ND5iS0fOl4U5LT4' },
  download: 'https://github.com/davidhjlindbergab/davidhjalmarlindberg.com/releases/download/blick-3.4.2/Blick-3.4.2-mac.zip',
  downloadWin: 'https://github.com/davidhjlindbergab/davidhjalmarlindberg.com/releases/download/blick-3.4.2/Blick-3.4.2-windows-x64.zip',
  version: '3.4.2'
};
