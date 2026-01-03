# Email Delivery Troubleshooting Guide

## Email Sent Successfully But Not Received?

If the server shows "✅ Email sent successfully" but you don't see the email, follow these steps:

### 1. Check Spam/Junk Folder
- Gmail often filters automated emails to spam
- Check the spam folder for emails from `thanujkrishna22@gmail.com`

### 2. Check Gmail Security Settings

#### For the Sending Account (thanujkrishna22@gmail.com):
1. Go to: https://myaccount.google.com/security
2. Enable **2-Step Verification** (required for App Passwords)
3. Generate an **App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "Schedulo" as the name
   - Copy the 16-character password
   - Update `EMAIL_PASS` in `.env` with this App Password

#### For the Receiving Account:
1. Check if emails from `thanujkrishna22@gmail.com` are being blocked
2. Go to: https://mail.google.com/mail/u/0/#settings/filters
3. Check if there are any filters blocking emails
4. Add `thanujkrishna22@gmail.com` to contacts to whitelist

### 3. Verify Email Configuration

Make sure your `.env` file has:
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=thanujkrishna22@gmail.com
EMAIL_PASS=your_16_character_app_password  # NOT your regular Gmail password!
```

### 4. Test Email Delivery

Run the test script:
```bash
node scripts/testEmail.js krishnabhargav1528@gmail.com
```

### 5. Check Gmail Activity

1. Go to: https://myaccount.google.com/security
2. Click "Recent security activity"
3. Check if there are any blocked login attempts
4. If you see "Blocked sign-in attempt", click "Yes, it was me"

### 6. Alternative: Use a Different Email Service

If Gmail continues to have issues, consider:
- **SendGrid** (free tier: 100 emails/day)
- **Mailgun** (free tier: 5,000 emails/month)
- **Amazon SES** (very cheap, pay per email)

### 7. Check Email Logs

The server logs show:
- Message ID: `<message-id>@gmail.com`
- Response: `250 2.0.0 OK` means Gmail accepted the email
- If you see `550` or `553` errors, the email was rejected

### Common Issues:

**Issue:** "Less secure app access" error
- **Solution:** Gmail no longer supports "less secure apps"
- **Fix:** Use App Password instead (see step 2)

**Issue:** Email goes to spam
- **Solution:** Add sender to contacts
- **Fix:** Mark as "Not Spam" when found in spam folder

**Issue:** Email not received at all
- **Solution:** Check Gmail filters and blocked senders
- **Fix:** Verify email address is correct

### Still Not Working?

1. Try sending to a different email address (non-Gmail)
2. Check if the receiving email address is correct
3. Verify the sending account has proper permissions
4. Consider using a dedicated email service for production

