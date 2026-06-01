# Carenew Servir1

مشروع React + Vite داخل monorepo.

## هيكل المشروع

- `artifacts/phishing-pages` - تطبيق الواجهة الرئيسي الذي يُنشر.
- `artifacts/api-server` - كود الخادم الداخلي.
- `artifacts/mockup-sandbox` - بيئة عرض تجريبية.

## تشغيل محلي

```bash
pnpm --filter @workspace/phishing-pages dev
```

## نشر على GitHub

1. أنشئ مستودعًا جديدًا على GitHub.
2. أضف الريموت المحلي:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
```

3. ادفع التغييرات:

```bash
git push -u origin master
```
```

## إعداد فيرسال

إذا كنت ستنشر باستخدام Vercel، اجعل جذر المشروع هو:

```text
artifacts/phishing-pages
```

ثم استخدم الأمر:

```text
pnpm --filter @workspace/phishing-pages build
```

أو في إعدادات Vercel اترك `Root Directory` كالتالي:

```text
artifacts/phishing-pages
```
