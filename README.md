# בין חלון לרחוב — אתר הספר

דף נחיתה ועמוד רכישה לספר של ד״ר שמואל בק.

- **האתר** — סטטי, מתארח בחינם ב-GitHub Pages ועולה אוטומטית ב-GitHub Actions.
- **התשלום** — PayPal (חשבון PayPal או כרטיס אשראי).
- **ההזמנות** — נשמרות ב-Supabase. פונקציית שרת קטנה (Edge Function) פותחת את התשלום, מוודאת מול PayPal שהוא עבר ובסכום הנכון, ורק אז מסמנת את ההזמנה כ״שולמה״.
- **ניהול** — עמוד `/admin` באתר, עם סיסמה: כל ההזמנות, סימון ״נשלחה״ / ״הגיעה״ / ״נאספה״, תיקון פרטים, הערות והורדה לאקסל.

---

## מה יש בפרויקט

| קובץ / תיקייה | מה זה |
|---|---|
| `src/config.ts` | **הגדרות**: מחיר, איסוף עצמי, פרטי העסק |
| `src/content/chapters.ts` | **הטקסטים** של דף הנחיתה |
| `src/pages/Checkout.tsx` | עמוד הרכישה: טופס פרטים + כפתורי PayPal |
| `src/pages/Terms.tsx`, `src/pages/Privacy.tsx` | תקנון ומדיניות פרטיות |
| `supabase/schema.sql` | **ה-SQL** שמקים את טבלת ההזמנות |
| `supabase/functions/checkout/index.ts` | **פונקציית השרת** של הרכישה (נפתחת ב-Supabase) |
| `src/pages/Admin.tsx` | עמוד הניהול (`/admin`) |
| `supabase/functions/admin/index.ts` | **פונקציית השרת** של עמוד הניהול |
| `public/` | כריכה, איורים, אייקון ותמונת שיתוף |
| `.github/workflows/deploy.yml` | בנייה והעלאה אוטומטית ל-GitHub Pages |

### איך הזמנה עובדת
1. הקונה ממלא פרטים (שם, טלפון, מייל, כתובת) ומאשר תקנון ופרטיות.
2. לוחץ על PayPal או על ״כרטיס אשראי״ ← הפונקציה שומרת את ההזמנה כ-`pending` ופותחת תשלום ב-PayPal **במחיר שנקבע בשרת**.
3. אחרי האישור ב-PayPal ← הפונקציה גובה, בודקת שהסכום נכון, ומסמנת `paid`.
4. הקונה רואה עמוד תודה עם מספר הזמנה (מ-1001 והלאה).

---

## שלב 1 — הרצה במחשב (לא חובה)

1. Node.js בגרסה 22 ומעלה (https://nodejs.org).
2. בטרמינל בתיקיית הפרויקט:
   ```bash
   npm install
   npm run dev
   ```
3. לפתוח את הכתובת שמופיעה (בדרך כלל http://localhost:5173).

---

## שלב 2 — גיטהאב ו-GitHub Pages

1. ריפו **ציבורי** בגיטהאב, והעלאת הקוד (`git push`).
2. בריפו: **Settings ← Pages ← Source ← GitHub Actions**.
3. בלשונית **Actions** הריצה צריכה להיות ירוקה. האתר זמין ב:
   `https://<שם-המשתמש>.github.io/bein-halon-larehov/`

מעכשיו כל `git push` מעדכן את האתר.

---

## שלב 3 — Supabase: טבלת ההזמנות

1. ב-Supabase פתח את הפרויקט ← **SQL Editor ← New query**.
2. הדבק את **כל** התוכן של `supabase/schema.sql` ← **Run**.
3. ב-**Table Editor** תופיע טבלה בשם `orders`.

> הרצת כבר גרסה קודמת של הקובץ? מריצים שוב את כולו — הוא לא מוחק נתונים, רק מוסיף את מה שחסר (למשל עמודת דמי המשלוח).

> הטבלה נעולה: אף אחד מהאינטרנט לא יכול לקרוא או לכתוב אליה. רק פונקציית השרת (עם המפתח הסודי שנמצא אצל Supabase) כותבת אליה, ורק אתה רואה אותה בלוח הבקרה.

---

## שלב 4 — PayPal: אפליקציה (Client ID + Secret)

1. חשבון **PayPal Business** עם חשבון בנק מקושר.
2. **Account Settings ← Website payments ← Website preferences ← PayPal account optional ← On** (כדי לאפשר תשלום בכרטיס בלי חשבון PayPal).
3. היכנס ל-https://developer.paypal.com ← **Apps & Credentials**.
4. **בדיקות קודם (מומלץ):** בחר למעלה **Sandbox** ← **Create App**. תקבל **Client ID** ו-**Secret** של סביבת בדיקות.
5. **לאוויר:** אותו דבר תחת **Live**.

> ה-**Client ID** ציבורי (נכנס לאתר). ה-**Secret** סודי — הוא נכנס **רק** ל-Supabase (שלב 5), לעולם לא לקוד ולא לגיטהאב.

---

## שלב 5 — Supabase: פונקציית השרת

### 5.1 הגדרת הסודות
ב-Supabase: **Edge Functions ← Secrets** (או Project Settings ← Edge Functions) ← הוסף:

| Name | Value |
|---|---|
| `PAYPAL_CLIENT_ID` | ה-Client ID מ-PayPal |
| `PAYPAL_CLIENT_SECRET` | ה-Secret מ-PayPal |
| `PAYPAL_ENV` | `sandbox` לבדיקות, `live` לאוויר |
| `ALLOWED_ORIGINS` | `https://eyalbeckai-cloud.github.io` (הכתובת של האתר, בלי סלאש בסוף) |
| `BOOK_PRICE`, `SHIPPING_PRICE` | לא חובה. רק אם משנים מחירים (ברירת מחדל: 55 לעותק, 30 משלוח להזמנה) |

לא צריך להגדיר `SUPABASE_URL` או מפתחות — Supabase מזריקים אותם לבד.

### 5.2 פרסום הפונקציה — דרך האתר של Supabase (הכי פשוט)
1. **Edge Functions ← Deploy a new function ← Via Editor**.
2. שם הפונקציה: `checkout` (בדיוק כך).
3. מחק את הקוד לדוגמה והדבק את **כל** התוכן של `supabase/functions/checkout/index.ts` ← **Deploy**.
4. בהגדרות הפונקציה **כבה** את **Verify JWT** (״Enforce JWT verification״). האתר קורא לפונקציה בלי התחברות; ההגנה היא בדיקת הכתובת (`ALLOWED_ORIGINS`), בדיקת הפרטים, והמחיר שנקבע בשרת.

### 5.3 מיילים אחרי הזמנה (תודה ללקוח + התראה אליכם)
אחרי כל תשלום הפונקציה שולחת שני מיילים מחשבון Gmail שלכם:
- **ללקוח** — תודה, מה הזמין, עלות, מספר הזמנה וכתובת המשלוח.
- **אליכם** — כל פרטי ההזמנה. ״השב״ במייל הזה כותב ישירות ללקוח.

**א. סיסמת אפליקציה ב-Gmail** (בחשבון שממנו יישלחו המיילים, למשל beck.eyal@gmail.com):
1. https://myaccount.google.com/security ← **אימות דו-שלבי** חייב להיות פעיל.
2. https://myaccount.google.com/apppasswords ← שם: `אתר הספר` ← **Create**.
3. מעתיקים את 16 התווים (סיסמה מיוחדת לאתר, לא הסיסמה הרגילה של Gmail).

**ב. Secrets ב-Supabase** (אותו מקום כמו בשלב 5.1):

| Name | Value |
|---|---|
| `SMTP_USER` | כתובת ה-Gmail ששולחת (למשל `beck.eyal@gmail.com`) |
| `SMTP_PASS` | סיסמת האפליקציה מסעיף א׳ |
| `NOTIFY_EMAILS` | הכתובות שמקבלות התראה על כל הזמנה, מופרדות בפסיק |
| `MAIL_FROM_NAME` | לא חובה. שם השולח (ברירת מחדל: בין חלון לרחוב) |

> הכתובות נמצאות ב-Secret ולא בקוד בכוונה: הריפו ציבורי, וכתובות שמופיעות בו נאספות על ידי ספאמרים.

**ג. מריצים שוב את `supabase/schema.sql`** (מוסיף עמודות לסטטוס המיילים) **ומפרסמים מחדש את הפונקציה** (מדביקים שוב את `index.ts` ← Deploy).

**איך יודעים שזה עבד:** בטבלה `orders` מתמלאות העמודות `customer_email_sent_at` ו-`notify_email_sent_at`. אם יש בעיה — היא תופיע ב-`email_error` וב-Logs של הפונקציה. ההזמנה עצמה נשמרת גם אם המייל נכשל.

מגבלות: Gmail מאפשר כ-500 מיילים ביום. Supabase חוסם את פורט 587, לכן הפונקציה משתמשת ב-465 (ברירת המחדל, לא צריך לשנות).

### 5.2 (חלופה) — דרך הטרמינל
```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase functions deploy checkout --no-verify-jwt
```
`PROJECT_REF` = החלק הראשון בכתובת הפרויקט (`https://<PROJECT_REF>.supabase.co`).

---

## שלב 6 — GitHub Secrets (לאתר)

בריפו: **Settings ← Secrets and variables ← Actions ← Secrets ← New repository secret**:

| Name | Value |
|---|---|
| `PAYPAL_CLIENT_ID` | ה-Client ID (אותו אחד כמו ב-Supabase — sandbox או live בהתאם) |
| `SUPABASE_URL` | `https://<PROJECT_REF>.supabase.co` (ב-Supabase: Project Settings ← API ← Project URL) |

אחר כך: **Actions ← Deploy to GitHub Pages ← Run workflow**.

> אם נשארו אצלך Secrets ישנים בשם `PAYPAL_BUTTON_SHIPPING` / `PAYPAL_BUTTON_PICKUP` — אפשר למחוק, כבר לא בשימוש.

---

## שלב 7 — בדיקה

### עם Sandbox (בלי כסף אמיתי)
1. Supabase: `PAYPAL_ENV = sandbox` + Client ID/Secret של Sandbox. גיטהאב: Client ID של Sandbox.
2. ב-developer.paypal.com ← **Sandbox accounts** יש חשבון קונה לבדיקות (Personal). אפשר גם לשלם בכרטיס בדיקה מ-https://developer.paypal.com/tools/sandbox/card-testing/.
3. בצע הזמנה באתר ← בדוק ב-Supabase שבטבלה `orders` השורה עם `status = paid`.

### מעבר לאוויר
החלף בשלושה מקומות: Supabase ← `PAYPAL_ENV = live` + Client ID/Secret של Live; גיטהאב ← `PAYPAL_CLIENT_ID` של Live; ואז **Run workflow**.
מומלץ לבצע קנייה אמיתית אחת ולהחזיר אותה (Refund) ב-PayPal. שים לב: בדרך כלל PayPal לא מחזירים את העמלה על עסקה שהוחזרה.

---

## שלב 8 — עמוד הניהול (`/admin`)

עמוד באתר שבו רואים ומנהלים את כל ההזמנות, בלי להיכנס לסופבייס. נכנסים אליו עם סיסמה אחת.

1. **הסיסמה:** Supabase ← **Edge Functions ← Secrets** ← מוסיפים `ADMIN_PASSWORD` עם סיסמה של **10 תווים לפחות** (מומלץ ארוכה, למשל שלוש מילים ומספר). זו הסיסמה ששמואל יקליד.
2. **הטבלה:** SQL Editor ← מריצים שוב את כל `supabase/schema.sql` (בטוח, לא מוחק כלום). זה מוסיף את המצב ״הגיעה ללקוח״ ואת ההגנה מניחוש סיסמה.
3. **הפונקציה:** Edge Functions ← **Deploy a new function ← Via Editor** ← שם: `admin` (בדיוק כך) ← מדביקים את **כל** `supabase/functions/admin/index.ts` ← **Deploy** ← מכבים **Verify JWT**, כמו ב-`checkout`.
   בטרמינל: `npx supabase functions deploy admin --no-verify-jwt`
4. **מעדכנים גם את `checkout`:** מדביקים שוב את `supabase/functions/checkout/index.ts` ← **Deploy** (תיקון קטן שמתאים למצב ״הגיעה ללקוח״).
5. דוחפים לגיט, וה-workflow מעלה את העמוד.

**הכתובת:** כתובת האתר + `/admin`, למשל `https://eyalbeckai-cloud.github.io/bein-halon-larehov/admin` (או `https://<הדומיין>/admin`). העמוד לא מקושר מהאתר ולא מופיע בגוגל. כדאי לשמור אותו במועדפים.

**מה יש בו:**
- למעלה: כמה הזמנות מחכות למשלוח ולאיסוף, וכמה נמכר עד היום.
- לשוניות: **לטיפול** (שולמו, מהישנה לחדשה) · **בדרך** · **הושלמו** · **בוטלו** · **לא שולמו** (אנשים שלא סיימו לשלם — לא חויבו).
- בכל הזמנה: כפתור אחד לשלב הבא (״נשלחה״ ← ״הגיעה ללקוח״, או ״נאספה״ באיסוף עצמי). אחרי כל סימון מופיע כפתור **ביטול** לכמה שניות, למקרה של טעות.
- התקשרות / וואטסאפ / מייל בלחיצה, העתקת שם וכתובת למדבקה.
- **עוד פעולות:** תיקון פרטי לקוח, חזרה לשלב הקודם, ביטול הזמנה (את ההחזר עצמו עושים ב-PayPal).
- **הערה פנימית** (למשל מספר מעקב של הדואר) — רק אתם רואים.
- **הורדה לאקסל** של הרשימה שעל המסך.

**אבטחה:** הסיסמה שמורה רק בסופבייס. אחרי 8 ניסיונות שגויים הכניסה ננעלת לרבע שעה. הכניסה נשמרת בדפדפן 14 יום (או עד ״יציאה״). **החלפת `ADMIN_PASSWORD` מנתקת מיד את כולם** — זה גם מה שעושים אם הסיסמה דלפה.

---

## איפה רואים את ההזמנות

**בעמוד הניהול** (שלב 8). כגיבוי, הכול נמצא גם ב-Supabase ← **Table Editor**:
- `orders` — כל ההזמנות (כולל `pending` שלא שולמו).
- `orders_to_ship` — שולמו ומחכות למשלוח, עם הכתובת.
- `orders_to_pickup` — שולמו ומחכות לאיסוף.
- `sales_summary` — כמה הזמנות, כמה ספרים, כמה כסף.

מצבים: `pending` (נפתח, לא שולם) · `paid` (שולם, מחכה לטיפול) · `payment_review` (שולם אבל חריג — לבדוק ב-PayPal) · `failed` · `shipped` (נשלח) · `delivered` (הגיע / נאסף) · `cancelled` · `refunded` (בוטל והכסף הוחזר).

---

## לפני שמפרסמים (משפטי — לא ייעוץ משפטי)

1. **פרטי העסק** — ב-`src/config.ts` ← `business` (שם, מספר עוסק, מייל, טלפון, כתובת). כל עוד ריקים, התקנון ומדיניות הפרטיות מציגים סימון צהוב.
2. **זמן אספקה** — `delivery.deliveryTime`.
3. **תקנון** (`/terms`) **ומדיניות פרטיות** (`/privacy`) — אלה תבניות. הקונה מאשר אותם בתיבת סימון לפני התשלום, והמועד נשמר בהזמנה. כדאי שעו״ד יעבור עליהם.
4. **קבלות** — PayPal לא מפיקים קבלה לפי החוק בישראל. צריך להפיק קבלה לכל מכירה (בתוכנת הנהלת חשבונות).
5. **מידע אישי** — אל תייצא את הטבלה לקבצים ששוכבים סתם במחשב/בוואטסאפ, ומחק הזמנות `pending` ישנות מדי פעם (יש פקודה בסוף `schema.sql`).

---

## שינויים נפוצים

- **טקסטים** — `src/content/chapters.ts`.
- **מחירים** — בשני מקומות, וחייבים להתאים:
  - מה שמוצג באתר: `src/config.ts` ← `book.price` (55) ו-`delivery.shipping.price` (30).
  - מה שנגבה בפועל: Supabase Secrets ← `BOOK_PRICE` ו-`SHIPPING_PRICE` (בלי Secret: 55 ו-30). איסוף עצמי תמיד חינם.
- **כמות מקסימלית בהזמנה** — `site.maxQuantity` ב-`config.ts` ו-`MAX_QUANTITY` בפונקציה (5).
- **איסוף עצמי** — `delivery.pickup.enabled`.
- **כריכה** — `public/cover.jpg`. **איורים בפרקים** — `public/scenes/`.
- **דומיין משלך** — Settings ← Pages ← Custom domain, ולעדכן את `ALLOWED_ORIGINS` ב-Supabase.

---

## תקלות

| מה רואים | מה לעשות |
|---|---|
| דף לבן / 404 | Settings ← Pages ← Source = **GitHub Actions**, ואז Re-run. |
| ״כאן יופיעו כפתורי התשלום״ | חסר `PAYPAL_CLIENT_ID` או `SUPABASE_URL` ב-GitHub Secrets, או שלא הרצת מחדש את ה-workflow. |
| ״לא הצלחנו לפתוח את התשלום״ | בדוק ב-Supabase ← Edge Functions ← checkout ← **Logs**. בדרך כלל: Secret חסר, Client ID/Secret לא מאותה סביבה (sandbox/live), או `ALLOWED_ORIGINS` לא תואם לכתובת האתר. |
| ״אין חיבור לשרת״ | הפונקציה לא פורסמה בשם `checkout`, או ש-Verify JWT עדיין דלוק. |
| הלקוח לא קיבל מייל | בטבלה `orders` בדוק את `email_error`. ״Invalid login״ = סיסמת אפליקציה שגויה או שאין אימות דו-שלבי. אם הכול ריק — חסרים `SMTP_USER`/`SMTP_PASS`. בקש מהלקוח לבדוק גם בספאם. |
| עמוד הניהול: ״עדיין לא הוגדרה סיסמה״ | חסר `ADMIN_PASSWORD` בסופבייס, או שהוא קצר מ-10 תווים. |
| עמוד הניהול: ״צריך להריץ שוב את schema.sql״ | מריצים שוב את כל `supabase/schema.sql` ב-SQL Editor. |
| עמוד הניהול: ״אין חיבור לשרת״ | הפונקציה `admin` לא פורסמה בשם הזה, או ש-Verify JWT דלוק בה. |
| שכחתם את סיסמת הניהול | מחליפים את `ADMIN_PASSWORD` בסופבייס. אין צורך לפרסם מחדש. |
| הזמנה ב-`payment_review` | הכסף עבר אבל משהו חריג (סכום שונה / PayPal עוד בודקים) — בדוק את העסקה ב-PayPal. |
