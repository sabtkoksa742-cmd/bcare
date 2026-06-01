# خطوات إصلاح Mixed Content Error على Vercel

## 🚀 الخطوات السريعة

### الخطوة 1: تأمين الخادم (تحويل HTTP إلى HTTPS)

اختر واحد من الخيارات:

#### ✅ الخيار أ: استخدام Let's Encrypt (مجاني)

على الخادم:

```bash
# تثبيت Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# الحصول على شهادة
sudo certbot certonly --standalone -d your-domain.com

# تحديث الخادم ليستخدم HTTPS
```

#### ✅ الخيار ب: استخدام Cloudflare (الأسهل)

1. افتح [cloudflare.com](https://cloudflare.com)
2. أضف موقعك
3. اختر **Free Plan**
4. ستحصل على HTTPS مجاناً

#### ✅ الخيار ج: استخدام Cloudflare Tunnel (للخادم المحلي)

```bash
# تحميل Cloudflare Tunnel CLI
# ثم تشغيل:
cloudflare-tunnel run --url http://localhost:5000
# ستحصل على HTTPS URL
```

---

### الخطوة 2: تحديث Vercel Environment Variables

1. **افتح Vercel Dashboard**
2. اختر مشروعك `tameen-bcare`
3. اذهب إلى **Settings**
4. اختر **Environment Variables**
5. أضف أو حدّث:

| المتغير | القيمة | الملاحظات |
|--------|--------|----------|
| `VITE_API_BASE_URL` | `https://your-api-domain.com/api` | استخدم HTTPS! |

**مثال:**
```
VITE_API_BASE_URL = https://api.example.com/api
```

6. اضغط **Save**

---

### الخطوة 3: إعادة Deploy

```bash
# في المشروع المحلي:
git add .
git commit -m "Fix HTTPS mixed content error"
git push

# أو من Vercel Dashboard:
# اضغط "Redeploy" على آخر deployment
```

---

## ✅ التحقق من أن المشكلة حُلت

```javascript
// افتح Vercel app
// اضغط F12 → Console
// إذا لم ترى:
// ❌ "Mixed Content" error
// معناه تم الحل ✅
```

---

## 📋 ملخص القيم

### في Vercel Dashboard:

```
VITE_API_BASE_URL = https://100.64.25.243:5000/api

أو

VITE_API_BASE_URL = https://your-tunnel-url.ngrok.io/api

أو

VITE_API_BASE_URL = https://api.yourdomain.com/api
```

---

## 🔍 استكشاف الأخطاء

### إذا لا تزال ترى المشكلة:

1. **تحقق من أن الخادم يعمل على HTTPS:**
   ```bash
   curl -I https://your-api.com/api/health
   ```

2. **تأكد من أن المتغير محفوظ:**
   - Vercel Dashboard → Settings → Environment Variables
   - تحقق أن `VITE_API_BASE_URL` موجود

3. **أعد Deploy:**
   ```bash
   git push
   # أو اضغط Redeploy من Vercel
   ```

4. **امسح Cache:**
   - افتح التطبيق
   - اضغط Ctrl+Shift+Delete
   - امسح الـ Cache والـ Cookies

---

## 🎯 الحل النهائي

**أهم شيء: جعل الخادم يعمل على HTTPS**

بعدها كل شيء سيعمل بدون مشاكل ✅

