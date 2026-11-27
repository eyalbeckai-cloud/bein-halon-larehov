# בין חלון לרחוב — אתר הספר

דף נחיתה ועמוד רכישה לספר של ד״ר שמואל בק.
האתר סטטי, ללא שרת: GitHub Pages מארח אותו בחינם, ו-PayPal מטפל בתשלום.

---

## מה יש בפרויקט

| קובץ / תיקייה | מה זה |
|---|---|
| `src/config.ts` | **כל ההגדרות**: מחיר, איסוף עצמי, פרטי העסק, PayPal |
| `src/content/chapters.ts` | **כל הטקסטים** של דף הנחיתה |
| `src/pages/Landing.tsx` | דף הנחיתה והאנימציות (GSAP) |
| `src/pages/Checkout.tsx` | עמוד הרכישה (`/checkout`) |
| `src/pages/Terms.tsx` | תקנון ומדיניות ביטולים (`/terms`) |
| `src/pages/ThankYou.tsx` | עמוד תודה אחרי תשלום (`/thank-you`) |
| `public/` | תמונות: אייקון, תמונת שיתוף לוואטסאפ, וכריכה (אם תוסיף) |
| `.github/workflows/deploy.yml` | בנייה והעלאה אוטומטית ל-GitHub Pages |

---

## שלב 1 — הרצה במחשב (לא חובה, אבל מומלץ)

1. התקן Node.js בגרסת LTS (22 ומעלה) מ-https://nodejs.org.
2. פתח טרמינל בתיקיית הפרויקט (ב-VS Code: ‏Terminal ← New Terminal).
3. הרץ:
   ```bash
   npm install
   npm run dev
   ```
4. פתח בדפדפן את הכתובת שמופיעה (בדרך כלל http://localhost:5173).

לבדיקה שהבנייה עוברת בדיוק כמו בגיטהאב: `npm run build`.

---

## שלב 2 — העלאה לגיטהאב

1. היכנס ל-https://github.com/new.
2. שם הריפו: למשל `bein-halon-larehov`.
3. בחר **Public**. (בחשבון GitHub חינמי, Pages עובד רק בריפו ציבורי.)
4. **אל** תסמן README, ‏‎.gitignore או License — הם כבר בפרויקט.
5. לחץ **Create repository**.
6. בטרמינל, בתיקיית הפרויקט:
   ```bash
   git init
   git add .
   git commit -m "אתר הספר בין חלון לרחוב"
   git branch -M main
   git remote add origin https://github.com/<שם-המשתמש>/bein-halon-larehov.git
   git push -u origin main
   ```
   (מחליפים את `<שם-המשתמש>` בשם המשתמש שלך בגיטהאב.)

---

## שלב 3 — הפעלת GitHub Pages

1. בריפו: **Settings ← Pages**.
2. תחת **Build and deployment ← Source** בחר **GitHub Actions**.
3. עבור ללשונית **Actions**. תראה ריצה בשם **Deploy to GitHub Pages**.
   - אם הריצה הראשונה נכשלה (זה קורה כשהיא רצה לפני שהפעלת את Pages): לחץ עליה ← **Re-run all jobs**.
4. כשהריצה ירוקה, האתר זמין בכתובת:
   `https://<שם-המשתמש>.github.io/bein-halon-larehov/`

מעכשיו כל `git push` לענף `main` מעדכן את האתר אוטומטית תוך דקה-שתיים.

> בשלב הזה עמוד הרכישה מציג מסגרת מקווקוות: ״כאן יופיע כפתור התשלום של PayPal״. זה תקין — מחברים את PayPal בשלב הבא.

---

## שלב 4 — חיבור PayPal

### 4.1 חשבון עסקי
1. פתח חשבון **PayPal Business** (או שדרג חשבון קיים) וקשר אליו חשבון בנק.
2. השלם את אימות החשבון ש-PayPal מבקשים.

### 4.2 אפשר תשלום בכרטיס אשראי בלי חשבון PayPal
**Account Settings ← Website payments ← Website preferences ← Update ← PayPal account optional ← On**

> גם כשזה פעיל, PayPal מחליטים לכל קונה אם להציג תשלום כאורח (לפי בדיקת סיכון, מדינה, ואם המייל כבר קשור לחשבון PayPal).

### 4.3 יצירת הכפתורים
ב-PayPal: **Pay links and buttons ← Create** (בתפריט Sales / Tools — המיקום משתנה מעט בין גרסאות).

**כפתור 1 — משלוח עד הבית**
- Product name: `בין חלון לרחוב — משלוח עד הבית`
- Price: `84`, Currency: **ILS** (שקל)
- Shipping fee: `0`
- כתובת למשלוח: **לאסוף** (Collect shipping address)
- סוג ההטמעה: **Stacked buttons** (הקוד עם `<script>`), לא ״HTML only״.

**כפתור 2 — איסוף עצמי** (רק אם השארת איסוף עצמי פעיל ב-`config.ts`)
- Product name: `בין חלון לרחוב — איסוף עצמי`
- Price: `84`, Currency: **ILS**
- כתובת למשלוח: **לא לאסוף** (Do not collect shipping address)

> שמות המוצרים הם הדרך שלך לדעת מה הקונה בחר: כל עסקה ב-PayPal תציג ״משלוח עד הבית״ (עם כתובת) או ״איסוף עצמי״.

אם יש בהגדרות הכפתור אפשרות להפנות לכתובת אחרי תשלום, הגדר:
`https://<שם-המשתמש>.github.io/bein-halon-larehov/thank-you/`

### 4.4 העתקת המזהים מהקוד ש-PayPal נותנים
הקוד נראה בערך כך:
```html
<script src="https://www.paypal.com/sdk/js?client-id=AbC123...&components=hosted-buttons&..."></script>
...
paypal.HostedButtons({ hostedButtonId: "XYZ789..." }).render("#paypal-container-XYZ789...")
```
- הערך אחרי `client-id=` (עד ה-`&`) הוא ה-**Client ID**.
- הערך של `hostedButtonId` הוא **מזהה הכפתור**. לכל כפתור מזהה משלו.

**לא מדביקים את הקוד באתר** — האתר כבר יודע לטעון את הכפתור. צריך רק את המזהים.

### 4.5 הכנסת המזהים לגיטהאב
בריפו: **Settings ← Secrets and variables ← Actions ← לשונית Variables ← New repository variable**.
צור שלושה משתנים:

| Name | Value |
|---|---|
| `PAYPAL_CLIENT_ID` | ה-Client ID |
| `PAYPAL_BUTTON_SHIPPING` | מזהה הכפתור של משלוח עד הבית |
| `PAYPAL_BUTTON_PICKUP` | מזהה הכפתור של איסוף עצמי (או לא ליצור, אם אין איסוף) |

> אלה ערכים ציבוריים (הם מופיעים בקוד של כל אתר עם כפתור PayPal), לכן **Variables** ולא Secrets.

### 4.6 פרסום מחדש
**Actions ← Deploy to GitHub Pages ← Run workflow**.
אחרי שהריצה ירוקה — היכנס ל-`/checkout` באתר ובדוק שהכפתור מופיע.

### 4.7 בדיקה לפני מכירה אמיתית (מומלץ)
- הכי פשוט: קנה עותק אחד בעצמך בכרטיס אשראי, ובצע החזר (Refund) מתוך PayPal. שים לב: בדרך כלל PayPal לא מחזירים את העמלה על עסקה שהוחזרה (כ-4.8 ₪).
- נסה גם מהנייד, בחלון גלישה בסתר, עם מייל שלא קשור ל-PayPal — כדי לראות את מסלול התשלום כאורח.

### לבדיקה במחשב
העתק את `.env.example` לקובץ בשם `.env.local`, מלא בו את אותם ערכים, והרץ `npm run dev`.

---

## שלב 5 — לפני שמפרסמים את האתר

1. **פרטי העסק** — ב-`src/config.ts`, תחת `business`: שם, מספר עוסק, מייל, טלפון, כתובת.
   כל עוד הם ריקים, עמוד התקנון מציג סימון צהוב ״[למלא...]״.
2. **זמן אספקה** — `delivery.deliveryTime`, למשל `'עד 7 ימי עסקים'`.
3. **איסוף עצמי** — אם אין: `delivery.pickup.enabled: false`.
4. **תקנון** — עמוד `/terms` הוא תבנית. כדאי שעו״ד או רו״ח יעברו עליו, במיוחד סעיף הביטולים.
5. **קבלות** — PayPal לא מפיקים קבלה לפי החוק בישראל. צריך להפיק קבלה לכל מכירה בנפרד (בתוכנת הנהלת חשבונות).

אחרי כל שינוי: `git add . && git commit -m "עדכון" && git push`.

---

## שינויים נפוצים

**טקסטים** — `src/content/chapters.ts`. כל פרק = מסך אחד בדף הנחיתה.

**מחיר** — `src/config.ts` ← `book.price`. אם משנים מחיר, צריך לעדכן אותו גם בכפתורים ב-PayPal.

**תמונת כריכה** — שים את התמונה ב-`public/cover.jpg` וכתוב ב-`config.ts`:
`coverImage: 'cover.jpg'`. בינתיים מוצגת כריכה מעוצבת.

**תמונת שיתוף בוואטסאפ/פייסבוק** — `public/og.jpg` (‏1200×630).

**דומיין משלך** — ‏Settings ← Pages ← Custom domain. האתר מתאים את עצמו לבד.

---

## איך האנימציה עובדת (למי שרוצה לשנות)

`src/pages/Landing.tsx`: כל המסכים יושבים זה על זה, ו-GSAP ScrollTrigger ״מצמיד״ אותם למסך.
בגלילה, המסך הבא נפתח מתוך החלון המואר של המסך הנוכחי (`clip-path`), וכל תנועת גלילה מעבירה מסך אחד בדיוק.
משתמשים שביקשו במערכת ההפעלה ״להפחית תנועה״ מקבלים דף גלילה רגיל, בלי אנימציה.

---

## תקלות

| מה רואים | מה לעשות |
|---|---|
| דף לבן / 404 אחרי ההעלאה | ‏Settings ← Pages ← Source צריך להיות **GitHub Actions**. אחר כך Re-run לריצה האחרונה. |
| הריצה ב-Actions נכשלה ב-Deploy | ודא שה-Source הוא GitHub Actions, ושהריפו ציבורי. |
| עדיין מופיעה המסגרת המקווקוות של PayPal | המשתנים לא הוגדרו או שהשם שלהם לא מדויק (`PAYPAL_CLIENT_ID` וכו׳), או שלא הרצת מחדש את ה-workflow. |
| ״אפשרויות התשלום לא נטענו״ | Client ID שגוי, או שהכפתור לא במטבע ILS. |
| הכפתור של PayPal לא מופיע בלי שגיאה | בדוק שהכפתור נוצר כ-Stacked buttons ובמטבע ILS. |
