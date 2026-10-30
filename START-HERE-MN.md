# Antigravity дээр ажиллуулах

Энэ бол Next.js App Router + TypeScript төсөл. Үндсэн код `src/` хавтсанд байна.

1. Node.js 22 буюу түүнээс шинэ LTS хувилбар суулгасан байна.
2. ZIP-ээ задлаад `proofpay-next` хавтсыг Antigravity дээр Open Folder хийнэ.
3. Terminal дээр дараах командуудыг дарааллаар ажиллуулна:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

4. Browser дээр `http://localhost:3000` нээнэ.

Одоо байгаа Supabase database-аа ашиглана. SQL-ийг дахин ажиллуулахгүй. Public URL болон publishable key `.env.example` дотор байгаа. Login хийхэд шинэ нууц key шаардахгүй.

Email confirmation болон password reset-ийг localhost дээр туршихдаа Supabase Authentication-ийн Redirect URLs-д `http://localhost:3000/login`, `http://localhost:3000/reset-password` хаягуудыг нэмнэ. Хуучин сайтын redirect-уудыг үлдээнэ.

AI, Browserless, PayPal код хараахан холбогдоогүй. Эдгээрийн нууц түлхүүрийг `NEXT_PUBLIC_` хувьсагчид, React компонент эсвэл `public/` дотор бичиж болохгүй.

Next.js ZIP нь татаж ажиллуулах хувилбар. Өмнөх байршуулсан сайт өөрчлөгдөөгүй. Нэвтрэх бүртгэл, database хэвээр; localhost дээр дахин нэвтэрнэ.

Antigravity-д эхлээд `README.md` болон `AGENTS.md`-ийг уншуул. Цагаан дизайн болон ажиллаж байгаа Supabase урсгалуудыг хадгалж, дутуу интеграцуудаа хэсэгчлэн хөгжүүл.
