// Built-in knowledge of common apps, used before (and alongside) AI classification.
// Partner lists are categories, not claims about specific contracts.
export const CATALOG = [
  { key: 'zomato', name: 'Zomato', domains: ['zomato.com'], category: 'Food', color: 'k8', dataTypes: ['Email', 'Phone', 'Address', 'Payment', 'Orders'], partnerTypes: ['Payment processor', 'Delivery partners', 'Advertising partners'] },
  { key: 'swiggy', name: 'Swiggy', domains: ['swiggy.in', 'swiggy.com'], category: 'Food', color: 'k6', dataTypes: ['Email', 'Phone', 'Address', 'Orders'], partnerTypes: ['Payment processor', 'Delivery partners', 'Advertising partners', 'Analytics'] },
  { key: 'zepto', name: 'Zepto', domains: ['zeptonow.com', 'zepto.co.in'], category: 'Food', color: 'k5', dataTypes: ['Phone', 'Address', 'Orders'], partnerTypes: ['Payment processor', 'Delivery partners'] },
  { key: 'blinkit', name: 'Blinkit', domains: ['blinkit.com'], category: 'Food', color: 'k6', dataTypes: ['Phone', 'Address', 'Orders'], partnerTypes: ['Payment processor', 'Delivery partners'] },
  { key: 'dominos', name: "Domino's", domains: ['dominos.co.in', 'jublfood.com'], category: 'Food', color: 'k3', dataTypes: ['Phone', 'Address', 'Orders'], partnerTypes: ['Payment processor', 'Advertising partners'] },
  { key: 'myntra', name: 'Myntra', domains: ['myntra.com'], category: 'Shopping', color: 'k2', dataTypes: ['Email', 'Phone', 'Address', 'Sizes', 'Orders'], partnerTypes: ['Logistics partner', 'Payment processor'] },
  { key: 'flipkart', name: 'Flipkart', domains: ['flipkart.com', 'flipkartletters.com'], category: 'Shopping', color: 'k9', dataTypes: ['Email', 'Phone', 'Address', 'Payment', 'Orders'], partnerTypes: ['Logistics partner', 'Payment processor', 'Advertising partners'] },
  { key: 'amazon', name: 'Amazon', domains: ['amazon.in', 'amazon.com'], category: 'Shopping', color: 'k6', dataTypes: ['Email', 'Phone', 'Address', 'Payment', 'Orders'], partnerTypes: ['Logistics partner', 'Payment processor', 'Advertising partners'] },
  { key: 'nykaa', name: 'Nykaa', domains: ['nykaa.com'], category: 'Shopping', color: 'k2', dataTypes: ['Email', 'Phone', 'Address'], partnerTypes: ['Logistics partner', 'Payment processor'] },
  { key: 'ajio', name: 'AJIO', domains: ['ajio.com'], category: 'Shopping', color: 'k7', dataTypes: ['Email', 'Phone', 'Address'], partnerTypes: ['Logistics partner'] },
  { key: 'meesho', name: 'Meesho', domains: ['meesho.com'], category: 'Shopping', color: 'k2', dataTypes: ['Phone', 'Address', 'Orders'], partnerTypes: ['Logistics partner', 'Payment processor'] },
  { key: 'makemytrip', name: 'MakeMyTrip', domains: ['makemytrip.com', 'mmt.com'], category: 'Travel', color: 'k1', dataTypes: ['Email', 'Phone', 'Passport', 'Payment', 'Trips'], partnerTypes: ['Airlines', 'Hotels', 'Insurance partner', 'Payment processor'] },
  { key: 'goibibo', name: 'Goibibo', domains: ['goibibo.com'], category: 'Travel', color: 'k1', dataTypes: ['Email', 'Phone', 'Trips'], partnerTypes: ['Airlines', 'Hotels'] },
  { key: 'irctc', name: 'IRCTC', domains: ['irctc.co.in'], category: 'Travel', color: 'k9', dataTypes: ['Email', 'Phone', 'ID details', 'Trips'], partnerTypes: ['Payment processor'] },
  { key: 'ola', name: 'Ola', domains: ['olacabs.com'], category: 'Travel', color: 'k10', dataTypes: ['Phone', 'Location', 'Trips'], partnerTypes: ['Payment processor', 'Insurance partner'] },
  { key: 'uber', name: 'Uber', domains: ['uber.com'], category: 'Travel', color: 'k7', dataTypes: ['Email', 'Phone', 'Location', 'Trips'], partnerTypes: ['Payment processor', 'Insurance partner'] },
  { key: 'rapido', name: 'Rapido', domains: ['rapido.bike'], category: 'Travel', color: 'k6', dataTypes: ['Phone', 'Location', 'Trips'], partnerTypes: ['Payment processor'] },
  { key: 'bookmyshow', name: 'BookMyShow', domains: ['bookmyshow.com'], category: 'Entertainment', color: 'k5', dataTypes: ['Email', 'Phone', 'City'], partnerTypes: ['Cinemas', 'Payment processor'] },
  { key: 'netflix', name: 'Netflix', domains: ['netflix.com'], category: 'Entertainment', color: 'k8', dataTypes: ['Email', 'Payment', 'Viewing history'], partnerTypes: ['Payment processor'] },
  { key: 'spotify', name: 'Spotify', domains: ['spotify.com'], category: 'Entertainment', color: 'k10', dataTypes: ['Email', 'Listening history'], partnerTypes: ['Advertising partners'] },
  { key: 'hotstar', name: 'JioHotstar', domains: ['hotstar.com', 'jiohotstar.com'], category: 'Entertainment', color: 'k3', dataTypes: ['Phone', 'Viewing history'], partnerTypes: ['Advertising partners'] },
  { key: 'razorpay', name: 'Razorpay', domains: ['razorpay.com'], category: 'Finance', color: 'k3', dataTypes: ['Email', 'Phone', 'Card (last 4)'], partnerTypes: [] },
  { key: 'paytm', name: 'Paytm', domains: ['paytm.com'], category: 'Finance', color: 'k9', dataTypes: ['Phone', 'KYC', 'Payments'], partnerTypes: ['Banks', 'Lending partners'] },
  { key: 'phonepe', name: 'PhonePe', domains: ['phonepe.com'], category: 'Finance', color: 'k5', dataTypes: ['Phone', 'Payments'], partnerTypes: ['Banks'] },
  { key: 'cred', name: 'CRED', domains: ['cred.club'], category: 'Finance', color: 'k7', dataTypes: ['Phone', 'Credit report', 'Cards'], partnerTypes: ['Banks', 'Credit bureaus'] },
  { key: 'policybazaar', name: 'Policybazaar', domains: ['policybazaar.com'], category: 'Finance', color: 'k3', dataTypes: ['Phone', 'Email', 'Health details'], partnerTypes: ['Insurance partners'] },
  { key: 'naukri', name: 'Naukri', domains: ['naukri.com'], category: 'Jobs', color: 'k3', dataTypes: ['Email', 'Phone', 'CV'], partnerTypes: ['Recruiters'] },
  { key: 'linkedin', name: 'LinkedIn', domains: ['linkedin.com'], category: 'Social', color: 'k9', dataTypes: ['Email', 'Phone', 'Work history'], partnerTypes: ['Advertising partners'] },
  { key: 'instagram', name: 'Instagram', domains: ['instagram.com', 'mail.instagram.com'], category: 'Social', color: 'k2', dataTypes: ['Email', 'Phone', 'Photos'], partnerTypes: ['Advertising partners'] },
  { key: 'practo', name: 'Practo', domains: ['practo.com'], category: 'Health', color: 'k4', dataTypes: ['Phone', 'Health records'], partnerTypes: ['Clinics', 'Labs'] },
  { key: 'pharmeasy', name: 'PharmEasy', domains: ['pharmeasy.in'], category: 'Health', color: 'k4', dataTypes: ['Phone', 'Address', 'Prescriptions'], partnerTypes: ['Pharmacies', 'Delivery partners'] },
  { key: 'urbancompany', name: 'Urban Company', domains: ['urbancompany.com'], category: 'Services', color: 'k7', dataTypes: ['Phone', 'Address'], partnerTypes: ['Service professionals'] },
  { key: 'coursera', name: 'Coursera', domains: ['coursera.org'], category: 'Education', color: 'k3', dataTypes: ['Email', 'Learning history'], partnerTypes: ['Universities'] },
  { key: 'unacademy', name: 'Unacademy', domains: ['unacademy.com'], category: 'Education', color: 'k10', dataTypes: ['Phone', 'Learning history'], partnerTypes: ['Advertising partners'] },
  // Fictional companies used by the demo scenario
  { key: 'adnexa', name: 'AdNexa (ad network)', domains: ['adnexa.example'], category: 'Advertising', color: 'k7', dataTypes: ['Email', 'City'], partnerTypes: [], fictional: true },
  { key: 'pizzapoint', name: 'PizzaPoint', domains: ['pizzapoint.example'], category: 'Food', color: 'k8', dataTypes: [], partnerTypes: [], fictional: true }
];

export const PERSONAL_DOMAINS = ['gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'proton.me', 'rediffmail.com', 'live.com'];

export function findInCatalog(domain) {
  const d = (domain || '').toLowerCase();
  return CATALOG.find(c => c.domains.some(x => d === x || d.endsWith('.' + x))) || null;
}

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

// A realistic sample inbox (sender + subject only), used when Gmail isn't connected.
export function sampleInbox() {
  const rows = [
    ['Zomato <noreply@zomato.com>', 'Your order from Biryani Blues is on its way', 12],
    ['Zomato <promotions@zomato.com>', 'Flat 60% off this weekend', 40],
    ['Swiggy <no-reply@swiggy.in>', 'Your Swiggy order receipt', 3],
    ['Swiggy Instamart <noreply@swiggy.in>', 'Delivered in 9 minutes', 6],
    ['Myntra <updates@myntra.com>', 'Your order has been shipped', 380],
    ['Myntra <offers@myntra.com>', 'End of Reason Sale starts now', 410],
    ['Flipkart <no-reply@flipkart.com>', 'Your Flipkart order has been delivered', 33],
    ['Flipkart <offers@flipkartletters.com>', 'Big Billion Days early access', 60],
    ['Amazon.in <auto-confirm@amazon.in>', 'Your Amazon.in order', 21],
    ['MakeMyTrip <noreply@makemytrip.com>', 'Booking confirmed: Chennai to Delhi', 760],
    ['MakeMyTrip <deals@makemytrip.com>', 'Summer travel deals', 700],
    ['Goibibo <noreply@goibibo.com>', 'Your hotel booking', 820],
    ['IRCTC <ticketadmin@irctc.co.in>', 'Booking confirmation PNR 4512…', 95],
    ['Ola <noreply@olacabs.com>', 'Your ride receipt', 180],
    ['Uber Receipts <noreply@uber.com>', 'Your Friday evening trip with Uber', 14],
    ['BookMyShow <tickets@bookmyshow.com>', 'Your tickets are confirmed', 365],
    ['Netflix <info@netflix.com>', 'Your monthly receipt', 25],
    ['Spotify <no-reply@spotify.com>', 'Your Premium plan', 30],
    ['Razorpay <no-reply@razorpay.com>', 'Payment successful to Zomato', 12],
    ['Paytm <alerts@paytm.com>', 'Money sent successfully', 8],
    ['PhonePe <noreply@phonepe.com>', 'Payment received', 50],
    ['CRED <protect@cred.club>', 'Your credit score is ready', 120],
    ['Policybazaar <care@policybazaar.com>', 'Your insurance quote', 540],
    ['Naukri <info@naukri.com>', 'Recruiters viewed your profile', 15],
    ['LinkedIn <messages-noreply@linkedin.com>', 'You appeared in 12 searches', 2],
    ['Practo <noreply@practo.com>', 'Appointment confirmed', 290],
    ['PharmEasy <care@pharmeasy.in>', 'Your order is out for delivery', 450],
    ['Urban Company <noreply@urbancompany.com>', 'Rate your service', 220],
    ['Coursera <no-reply@coursera.org>', 'Continue your course', 600],
    ['Unacademy <hello@unacademy.com>', 'New batch starting', 900],
    ['Nykaa <noreply@nykaa.com>', 'Your Nykaa order', 720],
    ['AJIO <noreply@ajio.com>', 'Big Bold Sale', 640],
    ['Meesho <noreply@meesho.com>', 'Order delivered', 500],
    ['Blinkit <noreply@blinkit.com>', 'Order delivered in 11 minutes', 20],
    ["Domino's <noreply@dominos.co.in>", 'Your pizza is on the way', 260],
    ['Rapido <noreply@rapido.bike>', 'Ride invoice', 75],
    ['Zepto <noreply@zeptonow.com>', 'Welcome to Zepto', 9],
    ['Lenskart <hello@lenskart.com>', 'Your eye test reminder', 330],
    ['Cult.fit <hello@cult.fit>', 'Your membership is expiring', 400],
    ['Decathlon <noreply@decathlon.in>', 'Thank you for shopping', 480],
    ['FirstCry <care@firstcry.com>', 'Exclusive offers', 980],
    ['Mom <amma.family@gmail.com>', 'Photos from the wedding', 5],
    ['Prof. Ravi <ravi.k@sathyabama.ac.in>', 'Project review on Monday', 4]
  ];
  return rows.map(([from, subject, d]) => ({ from, subject, date: daysAgo(d) }));
}

// Apps found through "Sign in with Google" (sample)
export function sampleGoogleSignins() {
  return [
    { app: 'Zomato', domain: 'zomato.com', lastUsed: daysAgo(90) },
    { app: 'MakeMyTrip', domain: 'makemytrip.com', lastUsed: daysAgo(720) },
    { app: 'Coursera', domain: 'coursera.org', lastUsed: daysAgo(600) },
    { app: 'Canva', domain: 'canva.com', lastUsed: daysAgo(200) },
    { app: 'Notion', domain: 'notion.so', lastUsed: daysAgo(30) },
    { app: 'Duolingo', domain: 'duolingo.com', lastUsed: daysAgo(500) }
  ];
}
