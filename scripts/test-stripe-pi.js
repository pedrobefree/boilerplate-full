const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

async function run() {
  const pis = await stripe.paymentIntents.list({ limit: 1 });
  console.dir(pis.data[0], { depth: 4 });
}

run().catch(console.error);
