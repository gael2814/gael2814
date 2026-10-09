# Ay Ay Tacos — Website, Lunch Preorders & Kitchen System

Authentic Mexican food, made from scratch in Northern Maine.
117 Sweden Street, Caribou, Maine.

This is the complete restaurant website and online preorder system:

| Area | Where |
| --- | --- |
| Public website & full menu | `/` |
| Online lunch preorder (cart, checkout, pickup time, payment) | `/order` |
| Customer order status (no account needed; link is in the email) | `/order/status/…` |
| Staff sign in | `/staff/login` |
| Live kitchen dashboard | `/staff/kitchen` |
| Production & ingredient reports (print / CSV / PDF) | `/staff/production` |
| Orders, history, refunds, pickup changes | `/staff/orders` |
| Menu, prices, photos, sold-out, limits, prep times, recipes | `/staff/menu` |
| Preorder hours, operating days, holidays, kitchen capacity | `/staff/schedule` |
| Sales analytics | `/staff/sales` |
| Logo, contact info, hours, tax rate | `/staff/settings` |
| Staff accounts & roles | `/staff/users` |

Built with Next.js, TypeScript, Tailwind CSS, PostgreSQL + Prisma, Stripe Checkout and Resend.

---

## How it works

### Preorder window
* Customers can **browse the menu anytime**. Ordering is open only from **9:00 to 10:30 AM Eastern** on the
  operating days you choose (DST is handled automatically).
* Every rule is checked **on the server**: the time window, closed days and dates, the manual "close now" switch, sold-out items and daily limits.
* Pickup is never scheduled before **11:00 AM**. The settings page won't allow an earlier first pickup.

### Smart pickup times
* Kitchen work is measured in **workload units**: **1 unit = 1 quesabirria order (3 tacos)**.
* Capacity starts at **8 units per 15-minute interval**, from your benchmark of 8 quesabirria orders every 15 minutes.
* Each menu item has its own workload. For example, the Family Pack = 3.34 (10 tacos) and a drink = 0.1.
* The kitchen can start cooking before opening (default **10:45 AM**, adjustable). Customers still never pick up before 11:00.
* Orders are cooked in pickup-time order. A new order gets the **earliest time at which it, and every order already booked, can realistically be ready**. When 11:00 is full, the customer is offered 11:15 or the next open time. Customers may also choose a later time.
* Customers see the estimated pickup time **before they pay**.
* **No overbooking:** checkout holds the capacity while the customer pays. A database lock makes simultaneous checkouts wait their turn. Failed, cancelled or abandoned payments release the hold automatically (holds expire after 31 minutes).

### Payments
* Payment uses **Stripe Checkout**: card, debit, Apple Pay and Google Pay. Card numbers never touch this server.
* An order reaches the kitchen **only after Stripe confirms payment**, through a signature-verified webhook.
* Duplicate webhooks, retries and double-clicks can never create duplicate orders or emails.
* Refunds (full or partial) can be issued from the dashboard. Refunds made in the Stripe Dashboard are synced back automatically.
* Payments are behind a provider interface (`src/lib/payments/`), so Square or Clover can be added later.

### Emails
* After payment, the customer gets a branded confirmation. It includes their name, order number, every item with quantities, subtotal, Maine sales tax, total paid, estimated pickup time and the restaurant address.
* If staff change the pickup time, an updated email is sent automatically. Cancellations and refunds also send an email.
* Every email is logged on the order (Orders → History & emails) and can be re-sent.

### Kitchen & reports
* The kitchen dashboard shows paid orders sorted by pickup time and updates every 5 seconds. New orders are highlighted, with an optional chime. Orders flash when **due soon** or **running late**, and status changes take one tap: Confirmed → Preparing → Ready for Pickup → Picked Up (or Cancelled).
* **Kitchen Production Report:** total of every dish, individual taco counts ("25 Quesabirria Orders = 75 individual tacos"), a breakdown by pickup time with workload against capacity, and order statuses.
* **Ingredient Preparation Report:** totals calculated **only from recipes you saved**, with units. It also shows the raw amount needed when you set a cooked yield %. Dishes without a recipe are listed, never guessed.
* At **10:30 AM** a final **cutoff snapshot** is saved. You can switch between it and the live report, which shows later changes and cancellations.
* Both reports can be printed and downloaded as **CSV or PDF**.

### Roles
| Role | Access |
| --- | --- |
| Owner | Everything |
| Manager | Orders (incl. pickup changes & cancellations), menu availability (sold out, limits, preorder on/off, prep times), schedule, capacity, production, recipes |
| Kitchen | Kitchen dashboard and production reports only |

---

## Preview it on your computer

Requirements: Node.js 20+ and PostgreSQL 14+.

```bash
npm install
cp .env.example .env          # then fill in DATABASE_URL, AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
# For local preview you can use:  PAYMENTS_PROVIDER="mock"
npm run db:migrate            # creates the tables
npm run db:seed               # loads the official menu and creates the owner account
npm run dev                   # http://localhost:3000
```

* Sign in at **http://localhost:3000/staff/login** with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
* Go to **Schedule** and choose your operating days. Preorders stay closed until you do.
* To try ordering outside 9:00–10:30, add `DEV_NOW_OVERRIDE="2026-10-12T09:30:00"` to `.env` (a Monday morning), then restart `npm run dev`. This setting is ignored in production.
* Without Stripe keys, `PAYMENTS_PROVIDER="mock"` shows a **test payment page** with "Pay" and "Decline" buttons. Production never allows it.
* Without `RESEND_API_KEY`, emails are printed in the terminal and logged on the order instead of being sent.

Run the automated tests (they need a PostgreSQL test database; set `TEST_DATABASE_URL` or use the default `aytacos_test`):

```bash
npm test
```

---

## Connect online payments (Stripe)

1. Create an account at <https://dashboard.stripe.com>. Stay in **Test mode** at first.
2. **Developers → API keys**: copy the *Secret key* (`sk_test_…`) into `STRIPE_SECRET_KEY`. Set `PAYMENTS_PROVIDER="stripe"`.
3. **Developers → Webhooks → Add endpoint**:
   * URL: `https://YOUR-DOMAIN/api/payments/stripe/webhook`
   * Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`
   * Copy the *Signing secret* (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`.
4. **Settings → Payment methods**: turn on Cards, Apple Pay and Google Pay. For Apple Pay, also add your domain under *Payment method domains*.
5. Place a test order with card `4242 4242 4242 4242` (any future date, any CVC). Check that it appears in the kitchen and that the email arrives.
6. To take real payments, activate your Stripe account. Then repeat steps 2–3 in **Live mode** and replace the keys with the `sk_live_…` key and the live webhook secret.

For local webhook testing: `stripe listen --forward-to localhost:3000/api/payments/stripe/webhook`.

## Configure customer emails (Resend)

1. Create an account at <https://resend.com> and **add and verify your domain** by adding the DNS records it shows you.
2. Create an API key and put it in `RESEND_API_KEY`.
3. Set `EMAIL_FROM`, e.g. `Ay Ay Tacos <orders@yourdomain.com>`. It must use the verified domain. Optionally set `EMAIL_REPLY_TO` to the restaurant inbox.

## Add and change menu items

Sign in as the owner → **Menu**.
* **Edit** any item to change the name, description, price, category or photo, or to hide it from the website.
* Use the checkboxes for **Sold out** and **Preorder** (whether online customers can order the item).
* **Daily limit** caps how many can be preordered per day.
* **Prep workload** and **Tacos per item** drive pickup times and production totals.
* Use **Recipe** to set ingredient amounts per item, and the **Ingredients** tab to set units and cooked yield %.
* Scroll to **Add a menu item** to add a new dish. Removing a dish that already has orders hides it, so your history stays intact.

## Deploy (Vercel + managed PostgreSQL)

1. Push this repository to GitHub.
2. Create a PostgreSQL database with a provider such as Neon, Supabase, Vercel Postgres or Railway. Copy the pooled connection string into `DATABASE_URL` and the direct one into `DIRECT_DATABASE_URL`.
3. In Vercel, choose **Add New → Project**, import the repo and add all variables from `.env.example`. Set `APP_URL` to your real domain, `AUTH_SECRET` to a long random value, and `CRON_SECRET` to another random value.
4. Run the migrations and seed against the production database once, from your computer:
   ```bash
   DATABASE_URL=… DIRECT_DATABASE_URL=… ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run db:migrate && npm run db:seed
   ```
5. Deploy. `vercel.json` schedules the 10:30 AM cutoff job. It runs at 14:31 and 15:31 UTC to cover daylight saving time, and running it twice is harmless. The snapshot is also created automatically the first time someone opens the production report after cutoff.
6. Add your custom domain in Vercel and point your DNS to it.

## Before accepting real orders — checklist

- [x] Official moose logo, menu descriptions and 8 food photos are loaded from the printed menu
- [ ] Optional: upload a **higher-resolution logo** (Business → Logo); the one cropped from the menu is ~250 px wide
- [ ] Optional: add photos for dishes that don't have one yet (Menu → Edit → Photo)
- [ ] Confirm the **Large Taco** ($9) and **Family Pack** ($80) prices. They are marked "price under review"
- [ ] Choose **operating days** (Schedule). Online preorders stay closed until you do
- [ ] Enter the **phone, email, ZIP, social links and hours** (Business)
- [ ] Confirm the **sales tax** rate (currently 8%, Maine's prepared-food rate) with your accountant
- [ ] Review the **prep workload** of every item and the **kitchen start time** (Menu, Schedule)
- [ ] Enter **recipes** for carne asada and anything else you want in the ingredient report
- [ ] Connect **Stripe** (test first, then live) and **Resend** with a verified domain
- [ ] Create **staff accounts** for managers and the kitchen, and change the owner password
- [ ] Place a full test order on a phone, from start to finish, before announcing it
