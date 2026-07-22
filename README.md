# GAMEPOINT Internet Cafe

> A modern all-in-one Internet Cafe Management System with membership, POS, marketplace, rewards, vouchers, and administrative tools.

![Status](https://img.shields.io/badge/status-active-success)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Supabase](https://img.shields.io/badge/Supabase-Backend-green)

---

## 📖 Overview

GAMEPOINT is a complete management platform designed for Internet Cafes and Gaming Lounges.

The platform combines customer membership, GP Funds, GP Points, POS, marketplace, vouchers, and administrative tools into a single modern web application.

---

## ✨ Features

### 👤 Membership
- Member registration
- Secure authentication
- Digital member cards
- Membership management

### 💳 GP Funds
- Cashless wallet
- Session payments
- Product purchases
- Transaction history

### 🎁 GP Points
- Loyalty rewards
- Redeemable gaming time
- Redeemable products

### 🖥️ PC Management
- Computer status monitoring
- Session management
- Lock / Unlock PCs
- Time extensions

### 💰 Point of Sale (POS)
- Inventory management
- Product sales
- Receipt generation
- Sales reports

### 🛒 Marketplace
- Buy & Sell listings
- Auctions
- Fixed-price listings
- Image uploads

### 🎟 Voucher System
- Voucher creation
- Voucher redemption
- Promotional vouchers

### 📊 Dashboard
- Revenue analytics
- Membership statistics
- Active sessions
- Marketplace insights

---

## 🛠 Tech Stack

**Frontend**
- Next.js 15
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

**Backend**
- Supabase
- PostgreSQL
- Row Level Security (RLS)
- Supabase Authentication
- Supabase Storage

**Deployment**
- Vercel
- GitHub

---

## 🚀 Getting Started

```bash
git clone https://github.com/yourusername/gamepoint.git

cd gamepoint

npm install
```

Create `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

Run development server

```bash
npm run dev
```

Build production

```bash
npm run build
npm start
```

---

## 📁 Project Structure

```text
app/
components/
lib/
hooks/
services/
supabase/
types/
public/
```

---

## 🔒 Security

- Row Level Security (RLS)
- Secure Authentication
- Role-Based Access Control
- Protected API Routes

---

## 📌 Roadmap

- [x] Membership
- [x] GP Funds
- [x] GP Points
- [x] POS
- [x] Marketplace
- [x] Voucher System
- [ ] Mobile App
- [ ] Tournament Management
- [ ] Reservation System
- [ ] AI Analytics

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

---

## 📄 License

MIT License

---

## 👨‍💻 Author

**Mark Michael Angelo Clarus**

Built with ❤️ for the gaming community.
